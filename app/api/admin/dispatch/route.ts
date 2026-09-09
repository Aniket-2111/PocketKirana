/**
 * GET & POST /api/admin/dispatch
 *
 * Dispatch Control Center & Routing Automation API
 *
 * GET: Returns active fulfillment queues, urgent SLA alerts, and picker/rider workloads.
 * POST: Handles manual dispatch reassignment overrides.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { getPostgresPool } from '@/lib/postgres';
import {
  evaluateOrderPriority,
  executeDispatchReassignment,
} from '@/lib/orderRoutingEngine';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin or Store Manager role required.' },
      { status: 403 }
    );
  }

  try {
    const pool = getPostgresPool();

    // 1. Fetch active orders in fulfillment pipeline
    const ordersRes = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.order_status,
        o.total_amount,
        COALESCE(o.placed_at, o.created_at, NOW())::text as placed_at,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
        pt.picker_name,
        pt.status as picking_status,
        da.delivery_partner_id,
        da.status as delivery_status
      FROM orders o
      LEFT JOIN picking_tasks pt ON pt.order_id = o.id
      LEFT JOIN delivery_assignments da ON da.order_id = o.id
      WHERE o.order_status IN ('placed', 'confirmed', 'picking', 'packing', 'ready_for_pickup', 'out_for_delivery')
      ORDER BY o.placed_at ASC
    `);

    const scoredOrders = ordersRes.rows.map((row) => {
      const priority = evaluateOrderPriority({
        orderId: row.id,
        orderNumber: row.order_number,
        placedAt: new Date(row.placed_at),
        itemCount: parseInt(row.item_count || '1', 10),
      });

      return {
        ...row,
        priorityLevel: priority.priorityLevel,
        timeRemainingMinutes: priority.timeRemainingMinutes,
        urgencyScore: priority.urgencyScore,
      };
    });

    const urgentOrders = scoredOrders.filter(
      (o) => o.priorityLevel === 'URGENT' || o.priorityLevel === 'HIGH'
    );

    const counts = {
      urgent: urgentOrders.length,
      picking: scoredOrders.filter((o) => o.order_status === 'picking').length,
      packing: scoredOrders.filter((o) => o.order_status === 'packing').length,
      readyForDelivery: scoredOrders.filter((o) => o.order_status === 'ready_for_pickup').length,
      outForDelivery: scoredOrders.filter((o) => o.order_status === 'out_for_delivery').length,
    };

    return NextResponse.json(
      {
        success: true,
        counts,
        urgentOrders,
        activePipeline: scoredOrders,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[Dispatch API GET Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to fetch dispatch pipeline.', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin or Store Manager role required.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      taskType,
      orderId,
      currentAssigneeId,
      newAssigneeId,
      newAssigneeName,
      reason,
    } = body;

    if (!taskType || !orderId || !newAssigneeId) {
      return NextResponse.json(
        { error: 'Missing required parameters (taskType, orderId, newAssigneeId).' },
        { status: 400 }
      );
    }

    await executeDispatchReassignment({
      taskType,
      orderId,
      currentAssigneeId: currentAssigneeId || 'unassigned',
      newAssigneeId,
      newAssigneeName: newAssigneeName || 'Assigned Partner',
      changedBy: auth.uid || 'admin',
      reason: reason || 'Manual Admin Reassignment',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Dispatch reassignment executed and audited successfully.',
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[Dispatch API POST Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to execute dispatch override.', details: err.message },
      { status: 500 }
    );
  }
}
