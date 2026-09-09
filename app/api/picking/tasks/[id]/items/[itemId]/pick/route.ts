/**
 * POST /api/picking/tasks/[id]/items/[itemId]/pick
 *
 * Picker scans barcode and confirms quantity for a single item.
 * Validates: task is 'accepted'/'picking', item belongs to task,
 *            caller is the assigned picker.
 * Writes:    picking_task_items.picked_quantity, status
 *            order_items.picked_quantity
 * Returns:   updated item + task summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: taskId, itemId } = await params;
    // ── Auth ─────────────────────────────────────────────────────────────────
    const auth = requireRole(req, ['picker', 'admin']);
    if (!auth) return NextResponse.json({ error: 'Unauthorized or insufficient role' }, { status: 401 });

    const { uid, role } = auth;

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      picked_quantity,
      barcode,
      status = 'picked', // 'picked' | 'partially_picked' | 'skipped' | 'out_of_stock'
    } = body;

    if (typeof picked_quantity !== 'number' || picked_quantity < 0) {
      return NextResponse.json({ error: 'picked_quantity must be a non-negative number' }, { status: 400 });
    }

    const VALID_STATUSES = ['picked', 'partially_picked', 'skipped', 'out_of_stock'];
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    const pool     = getPostgresPool();

    // ── Load task + item ──────────────────────────────────────────────────────
    const taskRes = await pool.query(
      `SELECT pt.id, pt.status AS task_status, pt.picker_id, pt.order_id
       FROM picking_tasks pt WHERE pt.id = $1`,
      [taskId]
    );

    if (taskRes.rowCount === 0) {
      return NextResponse.json({ error: 'Picking task not found' }, { status: 404 });
    }

    const task = taskRes.rows[0];

    if (!['accepted', 'picking'].includes(task.task_status)) {
      return NextResponse.json(
        { error: `Cannot pick items when task status is: ${task.task_status}` },
        { status: 409 }
      );
    }

    // Enforce that only the assigned picker (or admin) can pick
    if (role !== 'admin' && task.picker_id !== uid) {
      return NextResponse.json({ error: 'Forbidden: not assigned to this task' }, { status: 403 });
    }

    const itemRes = await pool.query(
      `SELECT * FROM picking_task_items WHERE id = $1 AND picking_task_id = $2`,
      [itemId, taskId]
    );

    if (itemRes.rowCount === 0) {
      return NextResponse.json({ error: 'Item not found in this task' }, { status: 404 });
    }

    const item = itemRes.rows[0];

    if (picked_quantity > item.required_quantity) {
      return NextResponse.json(
        { error: `picked_quantity (${picked_quantity}) exceeds required_quantity (${item.required_quantity})` },
        { status: 400 }
      );
    }

    // ── Transaction ───────────────────────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update picking task item
      await client.query(
        `UPDATE picking_task_items
         SET picked_quantity = $1, status = $2, barcode = COALESCE($3, barcode),
             updated_at = NOW()
         WHERE id = $4`,
        [picked_quantity, status, barcode || null, itemId]
      );

      // Mirror picked_quantity onto order_items for admin visibility
      await client.query(
        `UPDATE order_items SET picked_quantity = $1 WHERE id = $2`,
        [picked_quantity, item.order_item_id]
      );

      // If task is still 'accepted', advance it to 'picking'
      if (task.task_status === 'accepted') {
        await client.query(
          `UPDATE picking_tasks SET status = 'picking', updated_at = NOW() WHERE id = $1`,
          [taskId]
        );
      }

      await client.query('COMMIT');

      // ── Return progress summary ───────────────────────────────────────────
      const progressRes = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'picked')          AS picked_count,
           COUNT(*) FILTER (WHERE status = 'out_of_stock')    AS out_of_stock_count,
           COUNT(*) FILTER (WHERE status = 'skipped')         AS skipped_count,
           COUNT(*) FILTER (WHERE status = 'pending')         AS pending_count,
           COUNT(*)                                            AS total_items
         FROM picking_task_items
         WHERE picking_task_id = $1`,
        [taskId]
      );

      const updatedItem = await pool.query(
        `SELECT * FROM picking_task_items WHERE id = $1`,
        [itemId]
      );

      return NextResponse.json({
        success: true,
        item: updatedItem.rows[0],
        progress: progressRes.rows[0],
      });

    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[POST /api/picking/tasks/[id]/items/[itemId]/pick]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
