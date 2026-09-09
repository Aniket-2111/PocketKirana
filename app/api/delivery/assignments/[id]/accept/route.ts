/**
 * POST /api/delivery/assignments/[id]/accept
 *
 * Delivery partner accepts an assigned delivery.
 *
 * Transitions: delivery_assignments.status: 'assigned' → 'accepted'
 *              orders.order_status: 'ASSIGNED' → 'ACCEPTED'
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

    if (assignment.status !== 'assigned') {
      return NextResponse.json(
        { error: `Cannot accept assignment in status: ${assignment.status}` },
        { status: 409 }
      );
    }

    // Delivery partner can only accept their own assignment
    if (role === 'delivery_partner') {
      const partnerRes = await pool.query(
        `SELECT id FROM delivery_partners WHERE firebase_uid = $1`, [uid]
      );
      if (partnerRes.rowCount === 0 || partnerRes.rows[0].id !== assignment.delivery_partner_id) {
        return NextResponse.json({ error: 'Forbidden: not assigned to this delivery' }, { status: 403 });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE delivery_assignments SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
        [assignmentId]
      );

      await client.query(
        `UPDATE orders SET order_status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`,
        [assignment.order_id]
      );

      await client.query(
        `INSERT INTO order_status_history
           (id, order_id, old_status, new_status, changed_by, changed_by_role, notes, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, 'ACCEPTED', $3, $4, 'Delivery partner accepted assignment', NOW())`,
        [assignment.order_id, assignment.order_status, uid, role]
      );

      await client.query('COMMIT');

      // Asynchronously coordinate real-time event & notification
      import('@/lib/businessEventDispatcher').then(({ emitBusinessEvent }) => {
        emitBusinessEvent({
          eventType: 'RIDER_ACCEPTED',
          orderId: assignment.order_id,
          recipientUid: assignment.firebase_uid,
          actorId: uid,
          actorRole: role as any,
          metadata: { assignmentId }
        }).catch(() => {});
      }).catch(() => {});

      return NextResponse.json({ success: true, order_status: 'ACCEPTED' });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[POST /api/delivery/assignments/[id]/accept]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
