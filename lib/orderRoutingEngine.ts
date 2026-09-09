/**
 * PocketKirana — Intelligent Order Routing & Dispatch Automation Engine (v1.1.0)
 *
 * Deterministic optimization engine for single-store darkstore operations:
 *   1. Order Priority & SLA Protection Engine (Urgent / High / Normal)
 *   2. Picker Workload-Aware Assignment
 *   3. Zone-Aware Pick Path Optimization (Zone A -> B -> C -> D -> E) with strict FEFO preservation
 *   4. Packing Station Load Balancing (Station 1-4)
 *   5. Delivery Partner Intelligent Matching & Capacity Safeguards (max 2 active orders)
 *   6. Dispatch Manual Override with immutable audit logging
 */

import { PoolClient } from 'pg';
import { getPostgresPool } from './postgres';
import { emitBusinessEvent } from './businessEventDispatcher';

export type OrderPriorityLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface OrderPriorityScore {
  orderId: string;
  orderNumber: string;
  ageMinutes: number;
  promisedEtaMinutes: number;
  timeRemainingMinutes: number;
  slaPercentRemaining: number;
  itemCount: number;
  priorityLevel: OrderPriorityLevel;
  urgencyScore: number; // 0 - 100
}

export interface DarkstoreZoneItem {
  itemId: string;
  productId: string;
  productName: string;
  zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  zoneSequence: number;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
}

export interface CandidatePicker {
  pickerId: string;
  pickerName: string;
  activeTasks: number;
  efficiencyRating: number; // 1.0 - 5.0
  isAvailable: boolean;
}

export interface CandidateRider {
  riderId: string;
  riderName: string;
  distanceKm: number;
  activeDeliveries: number;
  maxCapacity: number; // default 2
  isAvailable: boolean;
}

/**
 * Calculates dynamic SLA priority for an order.
 */
export function evaluateOrderPriority(params: {
  orderId: string;
  orderNumber: string;
  placedAt: Date;
  promisedDurationMinutes?: number;
  itemCount?: number;
  highDemandMode?: boolean;
}): OrderPriorityScore {
  const {
    orderId,
    orderNumber,
    placedAt,
    promisedDurationMinutes = 30,
    itemCount = 3,
    highDemandMode = false,
  } = params;

  const now = new Date();
  const ageMs = now.getTime() - new Date(placedAt).getTime();
  const ageMinutes = Math.max(0, Math.floor(ageMs / 60000));
  const timeRemainingMinutes = Math.max(0, promisedDurationMinutes - ageMinutes);
  const slaPercentRemaining = Math.max(
    0,
    Math.round((timeRemainingMinutes / promisedDurationMinutes) * 100)
  );

  let priorityLevel: OrderPriorityLevel = 'NORMAL';
  let urgencyScore = 50;

  if (slaPercentRemaining <= 25 || timeRemainingMinutes <= 5) {
    priorityLevel = 'URGENT';
    urgencyScore = 95;
  } else if (slaPercentRemaining <= 50 || timeRemainingMinutes <= 15) {
    priorityLevel = 'HIGH';
    urgencyScore = 75;
  } else if (highDemandMode) {
    priorityLevel = 'HIGH';
    urgencyScore = 70;
  } else {
    priorityLevel = 'NORMAL';
    urgencyScore = 40;
  }

  // Adjust for larger basket complexity
  if (itemCount > 8) urgencyScore += 5;

  return {
    orderId,
    orderNumber,
    ageMinutes,
    promisedEtaMinutes: promisedDurationMinutes,
    timeRemainingMinutes,
    slaPercentRemaining,
    itemCount,
    priorityLevel,
    urgencyScore: Math.min(100, urgencyScore),
  };
}

/**
 * Selects optimal picker based on active load and efficiency.
 */
export function selectOptimalPicker(pickers: CandidatePicker[]): CandidatePicker | null {
  const available = pickers.filter((p) => p.isAvailable);
  if (available.length === 0) return null;

  // Sort by lowest active tasks, then highest efficiency rating
  return available.sort((a, b) => {
    if (a.activeTasks !== b.activeTasks) return a.activeTasks - b.activeTasks;
    return b.efficiencyRating - a.efficiencyRating;
  })[0];
}

/**
 * Generates an efficient zone-ordered picking path while preserving FEFO batch allocation.
 */
export function generateZoneAwarePickPath(items: {
  itemId: string;
  productId: string;
  productName: string;
  categorySlug?: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
}[]): DarkstoreZoneItem[] {
  const zoneMap: Record<string, { zone: DarkstoreZoneItem['zone']; seq: number }> = {
    staples: { zone: 'Zone A', seq: 1 },
    grains: { zone: 'Zone A', seq: 1 },
    beverages: { zone: 'Zone B', seq: 2 },
    drinks: { zone: 'Zone B', seq: 2 },
    dairy: { zone: 'Zone C', seq: 3 },
    milk: { zone: 'Zone C', seq: 3 },
    personal_care: { zone: 'Zone D', seq: 4 },
    cleaning: { zone: 'Zone E', seq: 5 },
    household: { zone: 'Zone E', seq: 5 },
  };

  return items
    .map((item) => {
      const match = zoneMap[item.categorySlug?.toLowerCase() || 'staples'] || {
        zone: 'Zone A',
        seq: 1,
      };
      return {
        itemId: item.itemId,
        productId: item.productId,
        productName: item.productName,
        zone: match.zone,
        zoneSequence: match.seq,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
      };
    })
    .sort((a, b) => a.zoneSequence - b.zoneSequence); // Walking route from Zone A to Zone E
}

/**
 * Selects optimal delivery partner based on proximity and capacity constraint (max 2 active orders).
 */
export function selectOptimalRider(riders: CandidateRider[]): CandidateRider | null {
  const eligible = riders.filter(
    (r) => r.isAvailable && r.activeDeliveries < (r.maxCapacity || 2)
  );
  if (eligible.length === 0) return null;

  // Sort by lowest active load first, then nearest distance
  return eligible.sort((a, b) => {
    if (a.activeDeliveries !== b.activeDeliveries)
      return a.activeDeliveries - b.activeDeliveries;
    return a.distanceKm - b.distanceKm;
  })[0];
}

/**
 * Manual Reassignment Override by Admin / Store Manager
 */
export async function executeDispatchReassignment(params: {
  taskType: 'PICKER' | 'RIDER';
  orderId: string;
  currentAssigneeId: string;
  newAssigneeId: string;
  newAssigneeName: string;
  changedBy: string;
  reason: string;
}): Promise<void> {
  const pool = getPostgresPool();
  const { taskType, orderId, currentAssigneeId, newAssigneeId, newAssigneeName, changedBy, reason } = params;

  if (taskType === 'PICKER') {
    await pool.query(
      `UPDATE picking_tasks 
       SET picker_id = $1, picker_name = $2, updated_at = NOW() 
       WHERE order_id = $3`,
      [newAssigneeId, newAssigneeName, orderId]
    );
  } else {
    await pool.query(
      `UPDATE delivery_assignments 
       SET delivery_partner_id = $1, assigned_by = $2, assigned_at = NOW() 
       WHERE order_id = $3`,
      [newAssigneeId, changedBy, orderId]
    );
  }

  // Audit event
  await emitBusinessEvent({
    eventType: 'DISPATCH_OVERRIDE',
    actorId: changedBy,
    actorRole: 'admin',
    metadata: {
      taskType,
      orderId,
      previousAssigneeId: currentAssigneeId,
      newAssigneeId,
      reason,
    },
  });
}
