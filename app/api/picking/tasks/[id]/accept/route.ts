/**
 * POST /api/picking/tasks/[id]/accept
 *
 * Picker accepts a pending picking task.
 * Validates: task exists, is 'pending', caller is an authenticated picker.
 * Writes:    picking_tasks.status = 'accepted', started_at = NOW()
 *            order_status_history entry
 * Returns:   updated task record
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
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or insufficient role' }, { status: 401 });
    }

    const { uid, role, name } = auth;

    const pool = getPostgresPool();

    // ── Load task ─────────────────────────────────────────────────────────────
    const taskRes = await pool.query(
      `SELECT pt.*, o.order_status
       FROM picking_tasks pt
       JOIN orders o ON o.id = pt.order_id
       WHERE pt.id = $1`,
      [taskId]
    );

    if (taskRes.rowCount === 0) {
      return NextResponse.json({ error: 'Picking task not found' }, { status: 404 });
    }

    const task = taskRes.rows[0];

    if (task.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot accept task in status: ${task.status}` },
        { status: 409 }
      );
    }

    // ── Transaction: accept task + log status change ──────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const now = new Date().toISOString();

      // Update picking task
      await client.query(
        `UPDATE picking_tasks
         SET status = 'accepted', picker_id = $1, picker_name = $2,
             started_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [uid, name || uid, taskId]
      );

      // Update order status: STOCK_RESERVED → PICKING
      await client.query(
        `UPDATE orders SET order_status = 'PICKING', updated_at = NOW() WHERE id = $1`,
        [task.order_id]
      );

      // Log status history
      await client.query(
        `INSERT INTO order_status_history
           (id, order_id, old_status, new_status, changed_by, changed_by_role, notes, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, 'PICKING', $3, $4, 'Picker accepted task', NOW())`,
        [task.order_id, task.order_status, uid, role]
      );

      await client.query('COMMIT');

      // ── Return updated task ───────────────────────────────────────────────
      const updatedTask = await pool.query(
        `SELECT pt.*, 
                json_agg(pti ORDER BY pti.created_at) AS items
         FROM picking_tasks pt
         LEFT JOIN picking_task_items pti ON pti.picking_task_id = pt.id
         WHERE pt.id = $1
         GROUP BY pt.id`,
        [taskId]
      );

      return NextResponse.json({
        success: true,
        task: updatedTask.rows[0],
      });

    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[POST /api/picking/tasks/[id]/accept]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
