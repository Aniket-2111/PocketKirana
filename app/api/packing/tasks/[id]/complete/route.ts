/**
 * POST /api/packing/tasks/[id]/complete
 *
 * Packer confirms all items are packed. This triggers:
 *   1. packing_tasks.status = 'packed' → 'ready_for_pickup'
 *   2. order.order_status = 'READY_FOR_PICKUP'
 *   3. order_status_history entry
 *
 * Body (optional): { notes: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    // ── Auth ─────────────────────────────────────────────────────────────────
    const auth = requireRole(req, ['picker', 'admin']);
    if (!auth) return NextResponse.json({ error: 'Unauthorized or insufficient role' }, { status: 401 });

    const { uid, role } = auth;

    const body  = await req.json().catch(() => ({}));
    const notes = body.notes ?? 'Packing confirmed — order ready for pickup';

    const pool   = getPostgresPool();

    // ── Load packing task ─────────────────────────────────────────────────────
    const taskRes = await pool.query(
      `SELECT pt.*, o.order_status
       FROM packing_tasks pt
       JOIN orders o ON o.id = pt.order_id
       WHERE pt.id = $1`,
      [taskId]
    );

    if (taskRes.rowCount === 0) {
      return NextResponse.json({ error: 'Packing task not found' }, { status: 404 });
    }

    const task = taskRes.rows[0];

    if (!['pending', 'in_progress'].includes(task.status)) {
      return NextResponse.json(
        { error: `Cannot complete packing task in status: ${task.status}` },
        { status: 409 }
      );
    }

    if (role !== 'admin' && task.packer_id !== uid) {
      return NextResponse.json({ error: 'Forbidden: not assigned to this packing task' }, { status: 403 });
    }

    // ── Transaction ───────────────────────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Complete packing task
      await client.query(
        `UPDATE packing_tasks
         SET status = 'ready_for_pickup', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [taskId]
      );

      // 2. Confirm all packing items
      await client.query(
        `UPDATE packing_items SET is_confirmed = TRUE WHERE packing_task_id = $1`,
        [taskId]
      );

      // 3. Advance order
      await client.query(
        `UPDATE orders
         SET order_status = 'READY_FOR_PICKUP', updated_at = NOW()
         WHERE id = $1`,
        [task.order_id]
      );

      // 4. Log status history
      await client.query(
        `INSERT INTO order_status_history
           (id, order_id, old_status, new_status, changed_by, changed_by_role, notes, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, 'READY_FOR_PICKUP', $3, $4, $5, NOW())`,
        [task.order_id, task.order_status, uid, role, notes]
      );

      await client.query('COMMIT');

      // Asynchronously coordinate real-time events and push notifications
      import('@/lib/businessEventDispatcher').then(({ emitBusinessEvent }) => {
        emitBusinessEvent({
          eventType: 'ORDER_PACKED',
          orderId: task.order_id,
          recipientUid: task.firebase_uid,
          actorId: uid,
          actorRole: role as any,
          metadata: { notes }
        }).catch(() => {});
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'Packing complete. Order is READY_FOR_PICKUP.',
        order_id: task.order_id,
        order_status: 'READY_FOR_PICKUP',
      });

    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[POST /api/packing/tasks/[id]/complete]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
