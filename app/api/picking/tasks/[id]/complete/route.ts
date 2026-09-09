/**
 * POST /api/picking/tasks/[id]/complete
 *
 * Picker marks all items picked. This triggers:
 *   1. picking_tasks.status = 'completed'
 *   2. order.order_status = 'PACKING'
 *   3. A packing_task record is auto-created
 *   4. order_status_history entry
 *
 * Validates: all items are in a terminal state (picked / partially_picked /
 *            skipped / out_of_stock) — no 'pending' items remaining.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';
import { randomUUID } from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    // ── Auth ─────────────────────────────────────────────────────────────────
    const auth = requireRole(req, ['picker', 'admin']);
    if (!auth) return NextResponse.json({ error: 'Unauthorized or insufficient role' }, { status: 401 });

    const { uid, role, name } = auth;

    const pool   = getPostgresPool();

    // ── Load task ─────────────────────────────────────────────────────────────
    const taskRes = await pool.query(
      `SELECT pt.*, o.order_status FROM picking_tasks pt
       JOIN orders o ON o.id = pt.order_id
       WHERE pt.id = $1`,
      [taskId]
    );

    if (taskRes.rowCount === 0) {
      return NextResponse.json({ error: 'Picking task not found' }, { status: 404 });
    }

    const task = taskRes.rows[0];

    if (!['accepted', 'picking'].includes(task.status)) {
      return NextResponse.json(
        { error: `Cannot complete task in status: ${task.status}` },
        { status: 409 }
      );
    }

    if (role !== 'admin' && task.picker_id !== uid) {
      return NextResponse.json({ error: 'Forbidden: not assigned to this task' }, { status: 403 });
    }

    // ── Verify no pending items ───────────────────────────────────────────────
    const pendingRes = await pool.query(
      `SELECT COUNT(*) AS pending_count FROM picking_task_items
       WHERE picking_task_id = $1 AND status = 'pending'`,
      [taskId]
    );

    const pendingCount = parseInt(pendingRes.rows[0].pending_count, 10);
    if (pendingCount > 0) {
      return NextResponse.json(
        {
          error: `${pendingCount} item(s) still pending. Scan or skip all items before completing.`,
          pending_count: pendingCount,
        },
        { status: 409 }
      );
    }

    // ── Transaction ───────────────────────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const now = new Date().toISOString();

      // 1. Complete picking task
      await client.query(
        `UPDATE picking_tasks
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [taskId]
      );

      // 2. Advance order status to PACKING
      await client.query(
        `UPDATE orders SET order_status = 'PACKING', updated_at = NOW() WHERE id = $1`,
        [task.order_id]
      );

      // 3. Log status history
      await client.query(
        `INSERT INTO order_status_history
           (id, order_id, old_status, new_status, changed_by, changed_by_role, notes, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, 'PACKING', $3, $4, 'All items picked — moving to packing', NOW())`,
        [task.order_id, task.order_status, uid, role]
      );

      // 4. Auto-create packing task
      const packingTaskId = randomUUID();
      await client.query(
        `INSERT INTO packing_tasks
           (id, picking_task_id, order_id, packer_id, packer_name, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())`,
        [packingTaskId, taskId, task.order_id, uid, name || uid]
      );

      // 5. Copy order_items into packing_items
      const orderItemsRes = await client.query(
        `SELECT id, picked_quantity FROM order_items WHERE order_id = $1`,
        [task.order_id]
      );

      for (const oi of orderItemsRes.rows) {
        await client.query(
          `INSERT INTO packing_items
             (id, packing_task_id, order_item_id, packed_quantity, is_confirmed, created_at)
           VALUES (gen_random_uuid()::text, $1, $2, 0, FALSE, NOW())`,
          [packingTaskId, oi.id]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Picking complete. Packing task created.',
        packing_task_id: packingTaskId,
        order_id: task.order_id,
        order_status: 'PACKING',
      });

    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[POST /api/picking/tasks/[id]/complete]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
