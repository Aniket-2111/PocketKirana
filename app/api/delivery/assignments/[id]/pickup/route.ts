/**
 * POST /api/delivery/assignments/[id]/pickup
 *
 * Delivery partner verifies the store handover OTP and marks order picked up.
 * The store OTP is generated when the order reaches READY_FOR_PICKUP and
 * stored in delivery_assignments.otp_code.
 *
 * Body: { otp: string }
 *
 * Transitions: delivery_assignments.status: 'arrived_store' → 'picked_up'
 *              orders.order_status: 'ARRIVED_AT_STORE' → 'PICKED_UP'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const auth = requireRole(req, ['delivery_partner', 'admin']);
    if (!auth) return NextResponse.json({ error: 'Unauthorized or insufficient role' }, { status: 401 });

    const { uid, role } = auth;

    const body = await req.json();
    const { otp } = body;

    if (!otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'otp is required' }, { status: 400 });
    }

    const pool = getPostgresPool();

    const asnRes = await pool.query(
      `SELECT da.*, o.order_status FROM delivery_assignments da
       JOIN orders o ON o.id = da.order_id
       WHERE da.id = $1`,
      [assignmentId]
    );

    if (asnRes.rowCount === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const assignment = asnRes.rows[0];

    if (assignment.status !== 'arrived_store') {
      return NextResponse.json(
        { error: `Cannot verify pickup in status: ${assignment.status}. Mark arrived at store first.` },
        { status: 409 }
      );
    }

    // ── OTP verification ──────────────────────────────────────────────────────
    // Admin bypass for manual override; partner must match OTP
    if (role !== 'admin') {
      if (!assignment.otp_code) {
        return NextResponse.json({ error: 'No OTP generated for this assignment' }, { status: 400 });
      }

      if (assignment.otp_code.trim() !== otp.trim()) {
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE delivery_assignments
         SET status = 'picked_up', picked_up_at = NOW()
         WHERE id = $1`,
        [assignmentId]
      );

      await client.query(
        `UPDATE orders SET order_status = 'PICKED_UP', updated_at = NOW() WHERE id = $1`,
        [assignment.order_id]
      );

      await client.query(
        `INSERT INTO order_status_history
           (id, order_id, old_status, new_status, changed_by, changed_by_role, notes, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, 'PICKED_UP', $3, $4, 'Store OTP verified — order picked up', NOW())`,
        [assignment.order_id, assignment.order_status, uid, role]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Store OTP verified. Order picked up.',
        order_status: 'PICKED_UP',
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[POST /api/delivery/assignments/[id]/pickup]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
