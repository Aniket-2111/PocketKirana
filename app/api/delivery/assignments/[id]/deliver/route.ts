/**
 * POST /api/delivery/assignments/[id]/deliver
 *
 * THE FINAL STEP: Delivery partner verifies customer OTP and marks delivered.
 *
 * Body: { otp: string, cod_collected?: boolean }
 *
 * Validates: assignment status is 'out_for_delivery' or 'arrived_customer'
 *            customer OTP matches delivery_assignments.delivery_otp
 *
 * On success:
 *   1. delivery_assignments.status = 'delivered', otp_verified = TRUE
 *   2. orders.order_status = 'DELIVERED', delivered_at = NOW()
 *   3. order_status_history entry
 *   4. delivery_earnings record created
 *
 * NOTE: FCM notification to customer is fired after response via background job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';
import { randomUUID } from 'crypto';

// Base delivery fee — in production, pull from delivery_zones or store config
const BASE_DELIVERY_FEE = 20.00;

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
    const { otp, cod_collected = false } = body;

    if (!otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'Customer OTP is required' }, { status: 400 });
    }

    const pool = getPostgresPool();

    const asnRes = await pool.query(
      `SELECT da.*, o.order_status, o.total_amount, o.payment_method
       FROM delivery_assignments da
       JOIN orders o ON o.id = da.order_id
       WHERE da.id = $1`,
      [assignmentId]
    );

    if (asnRes.rowCount === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const assignment = asnRes.rows[0];
    const VALID_STATUSES_FOR_DELIVERY = ['out_for_delivery', 'arrived_customer'];

    if (!VALID_STATUSES_FOR_DELIVERY.includes(assignment.status)) {
      return NextResponse.json(
        { error: `Cannot deliver in status: ${assignment.status}` },
        { status: 409 }
      );
    }

    // ── OTP verification ──────────────────────────────────────────────────────
    if (role !== 'admin') {
      if (!assignment.delivery_otp) {
        return NextResponse.json({ error: 'No customer OTP generated for this assignment' }, { status: 400 });
      }

      if (assignment.delivery_otp.trim() !== otp.trim()) {
        return NextResponse.json({ error: 'Invalid customer OTP' }, { status: 400 });
      }
    }

    // ── COD validation ────────────────────────────────────────────────────────
    if (assignment.payment_method === 'cod' && !cod_collected) {
      return NextResponse.json(
        { error: 'COD order: mark cod_collected as true after collecting payment' },
        { status: 400 }
      );
    }

    // ── Transaction ───────────────────────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Mark assignment delivered
      await client.query(
        `UPDATE delivery_assignments
         SET status = 'delivered',
             delivered_at = NOW(),
             otp_verified = TRUE,
             cod_collected = $1
         WHERE id = $2`,
        [cod_collected, assignmentId]
      );

      // 2. Mark order DELIVERED
      await client.query(
        `UPDATE orders
         SET order_status = 'DELIVERED',
             delivered_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [assignment.order_id]
      );

      // 3. Log status history
      await client.query(
        `INSERT INTO order_status_history
           (id, order_id, old_status, new_status, changed_by, changed_by_role, notes, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, 'DELIVERED', $3, $4,
                 'Customer OTP verified — order delivered successfully', NOW())`,
        [assignment.order_id, assignment.order_status, uid, role]
      );

      // 4. Create delivery earnings record
      const earningsId = randomUUID();
      await client.query(
        `INSERT INTO delivery_earnings
           (id, delivery_partner_id, assignment_id, order_id,
            base_fee, distance_fee, peak_bonus, total_earnings, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 0.00, 0.00, $5, 'pending', NOW(), NOW())`,
        [earningsId, assignment.delivery_partner_id, assignmentId, assignment.order_id, BASE_DELIVERY_FEE]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Order delivered successfully. Customer OTP verified.',
        order_id: assignment.order_id,
        order_status: 'DELIVERED',
        earnings_id: earningsId,
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[POST /api/delivery/assignments/[id]/deliver]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
