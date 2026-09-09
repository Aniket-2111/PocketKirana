/**
 * PocketKirana — Order State Machine
 *
 * Client-side validator for order status transitions.
 * This mirrors the server-side rules in Cloud Functions
 * to provide instant UI feedback before making the network call.
 *
 * NOTE: The authoritative transition logic is in Cloud Functions.
 *       This file is for UI-layer validation only.
 */

import { OrderStatus, UserRole } from '@/types';

// ══════════════════════════════════════════
// DISPLAY LABELS FOR EACH STATUS
// ══════════════════════════════════════════

export const ORDER_STATUS_LABELS: Record<string, string> = {
  // Production statuses
  CREATED: 'Order Created',
  PAYMENT_PENDING: 'Awaiting Payment',
  PAYMENT_FAILED: 'Payment Failed',
  CONFIRMED: 'Order Confirmed',
  STOCK_RESERVED: 'Stock Reserved',
  PICKING: 'Being Picked',
  PICKING_FAILED: 'Picking Issue',
  PICKED: 'Items Picked',
  PACKING: 'Packing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  ASSIGNED: 'Partner Assigned',
  ACCEPTED: 'Partner Heading to Store',
  ARRIVED_AT_STORE: 'Partner at Store',
  PICKED_UP: 'Order Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  ARRIVED_AT_CUSTOMER: 'Partner Nearby',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  OUT_OF_STOCK: 'Out of Stock',
  CUSTOMER_UNAVAILABLE: 'Customer Unavailable',
  DELIVERY_FAILED: 'Delivery Failed',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
  // Legacy aliases
  placed: 'Order Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  packed: 'Packed',
  ready: 'Ready',
  partner_assigned: 'Partner Assigned',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// ══════════════════════════════════════════
// STATUS EMOJI
// ══════════════════════════════════════════

export const ORDER_STATUS_EMOJI: Record<string, string> = {
  CREATED: '📋',
  PAYMENT_PENDING: '💳',
  PAYMENT_FAILED: '❌',
  CONFIRMED: '✅',
  STOCK_RESERVED: '📦',
  PICKING: '🛒',
  PICKING_FAILED: '⚠️',
  PICKED: '✔️',
  PACKING: '📦',
  READY_FOR_PICKUP: '🔔',
  ASSIGNED: '🛵',
  ACCEPTED: '🛵',
  ARRIVED_AT_STORE: '🏪',
  PICKED_UP: '📦',
  OUT_FOR_DELIVERY: '🚴',
  ARRIVED_AT_CUSTOMER: '📍',
  DELIVERED: '✅',
  COMPLETED: '⭐',
  CANCELLED: '❌',
  OUT_OF_STOCK: '⚠️',
  CUSTOMER_UNAVAILABLE: '📵',
  DELIVERY_FAILED: '❌',
  RETURNED: '↩️',
  REFUNDED: '💚',
  // Legacy
  placed: '📋',
  accepted: '✅',
  preparing: '🛒',
  packed: '📦',
  ready: '🔔',
  partner_assigned: '🛵',
  picked_up: '📦',
  out_for_delivery: '🚴',
  delivered: '✅',
  cancelled: '❌',
};

// ══════════════════════════════════════════
// STATUS COLORS (Tailwind classes)
// ══════════════════════════════════════════

export const ORDER_STATUS_COLOR: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-700',
  PAYMENT_PENDING: 'bg-yellow-100 text-yellow-700',
  PAYMENT_FAILED: 'bg-red-100 text-red-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  STOCK_RESERVED: 'bg-blue-100 text-blue-700',
  PICKING: 'bg-purple-100 text-purple-700',
  PICKING_FAILED: 'bg-orange-100 text-orange-700',
  PICKED: 'bg-blue-100 text-blue-700',
  PACKING: 'bg-purple-100 text-purple-700',
  READY_FOR_PICKUP: 'bg-teal-100 text-teal-700',
  ASSIGNED: 'bg-indigo-100 text-indigo-700',
  ACCEPTED: 'bg-indigo-100 text-indigo-700',
  ARRIVED_AT_STORE: 'bg-indigo-100 text-indigo-700',
  PICKED_UP: 'bg-cyan-100 text-cyan-700',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-700',
  ARRIVED_AT_CUSTOMER: 'bg-green-100 text-green-700',
  DELIVERED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  OUT_OF_STOCK: 'bg-orange-100 text-orange-700',
  CUSTOMER_UNAVAILABLE: 'bg-orange-100 text-orange-700',
  DELIVERY_FAILED: 'bg-red-100 text-red-700',
  RETURNED: 'bg-gray-100 text-gray-700',
  REFUNDED: 'bg-green-100 text-green-700',
  // Legacy
  placed: 'bg-gray-100 text-gray-700',
  accepted: 'bg-green-100 text-green-700',
  preparing: 'bg-purple-100 text-purple-700',
  packed: 'bg-blue-100 text-blue-700',
  ready: 'bg-teal-100 text-teal-700',
  partner_assigned: 'bg-indigo-100 text-indigo-700',
  picked_up: 'bg-cyan-100 text-cyan-700',
  out_for_delivery: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

// ══════════════════════════════════════════
// CUSTOMER-VISIBLE TRACKING STAGES
// ══════════════════════════════════════════

export interface TrackingStage {
  id: string;
  label: string;
  description: string;
  icon: string;
  isActive: boolean;
  isCompleted: boolean;
}

export function getOrderTrackingStages(currentStatus: OrderStatus | string): TrackingStage[] {
  const stages = [
    { id: 'order_placed', label: 'Order Placed', description: 'Your order has been received', icon: '📋' },
    { id: 'confirmed', label: 'Confirmed', description: 'Order confirmed & stock reserved', icon: '✅' },
    { id: 'preparing', label: 'Preparing', description: 'Picker is collecting your items', icon: '🛒' },
    { id: 'packed', label: 'Packed', description: 'Items packed & ready for delivery', icon: '📦' },
    { id: 'on_the_way', label: 'On the Way', description: 'Delivery partner is coming', icon: '🚴' },
    { id: 'delivered', label: 'Delivered', description: 'Order delivered successfully', icon: '✅' },
  ];

  const statusToStageIndex: Record<string, number> = {
    CREATED: 0,
    PAYMENT_PENDING: 0,
    CONFIRMED: 1,
    STOCK_RESERVED: 1,
    PICKING: 2,
    PICKED: 2,
    PACKING: 3,
    READY_FOR_PICKUP: 3,
    ASSIGNED: 4,
    ACCEPTED: 4,
    ARRIVED_AT_STORE: 4,
    PICKED_UP: 4,
    OUT_FOR_DELIVERY: 4,
    ARRIVED_AT_CUSTOMER: 4,
    DELIVERED: 5,
    COMPLETED: 5,
    // Legacy
    placed: 0,
    accepted: 1,
    preparing: 2,
    packed: 3,
    partner_assigned: 4,
    picked_up: 4,
    out_for_delivery: 4,
    delivered: 5,
  };

  const activeIdx = statusToStageIndex[currentStatus as string] ?? 0;

  return stages.map((stage, idx) => ({
    ...stage,
    isCompleted: idx < activeIdx,
    isActive: idx === activeIdx,
  }));
}

// ══════════════════════════════════════════
// VALID TRANSITION CHECKER (for UI)
// ══════════════════════════════════════════

interface TransitionRule {
  nextStatus: string;
  allowedRoles: UserRole[];
  label: string;
}

export const VALID_TRANSITIONS: Partial<Record<string, TransitionRule[]>> = {
  CREATED: [
    { nextStatus: 'PAYMENT_PENDING', allowedRoles: ['admin', 'customer'], label: 'Awaiting Payment' },
    { nextStatus: 'CONFIRMED', allowedRoles: ['admin', 'customer'], label: 'Confirm Order' },
    { nextStatus: 'PAYMENT_FAILED', allowedRoles: ['admin'], label: 'Mark Payment Failed' },
    { nextStatus: 'CANCELLED', allowedRoles: ['admin', 'customer'], label: 'Cancel Order' },
  ],
  PAYMENT_PENDING: [
    { nextStatus: 'CONFIRMED', allowedRoles: ['admin', 'customer'], label: 'Confirm Payment' },
    { nextStatus: 'PAYMENT_FAILED', allowedRoles: ['admin'], label: 'Mark Payment Failed' },
    { nextStatus: 'CANCELLED', allowedRoles: ['admin', 'customer'], label: 'Cancel Order' },
  ],
  CONFIRMED: [
    { nextStatus: 'STOCK_RESERVED', allowedRoles: ['admin'], label: 'Reserve Stock' },
    { nextStatus: 'CANCELLED', allowedRoles: ['admin', 'customer'], label: 'Cancel Order' },
  ],
  STOCK_RESERVED: [
    { nextStatus: 'PICKING', allowedRoles: ['picker', 'admin'], label: 'Start Picking' },
    { nextStatus: 'CANCELLED', allowedRoles: ['admin', 'customer'], label: 'Cancel Order' },
  ],
  PICKING: [
    { nextStatus: 'PICKED', allowedRoles: ['picker', 'admin'], label: 'Complete Picking' },
    { nextStatus: 'PICKING_FAILED', allowedRoles: ['picker', 'admin'], label: 'Mark Picking Failed' },
    { nextStatus: 'OUT_OF_STOCK', allowedRoles: ['picker', 'admin'], label: 'Mark Out of Stock' },
    { nextStatus: 'CANCELLED', allowedRoles: ['admin'], label: 'Cancel Order' },
  ],
  PICKED: [
    { nextStatus: 'PACKING', allowedRoles: ['picker', 'admin'], label: 'Start Packing' },
  ],
  PACKING: [
    { nextStatus: 'PACKED', allowedRoles: ['picker', 'admin'], label: 'Pack Products' },
    { nextStatus: 'READY_FOR_PICKUP', allowedRoles: ['picker', 'admin'], label: 'Mark Ready for Pickup' },
  ],
  PACKED: [
    { nextStatus: 'READY_FOR_PICKUP', allowedRoles: ['picker', 'admin'], label: 'Mark Ready for Pickup' },
  ],
  READY_FOR_PICKUP: [
    { nextStatus: 'ASSIGNED', allowedRoles: ['admin'], label: 'Assign Partner' },
  ],
  ASSIGNED: [
    { nextStatus: 'ACCEPTED', allowedRoles: ['delivery_partner', 'admin'], label: 'Partner Accept' },
    { nextStatus: 'READY_FOR_PICKUP', allowedRoles: ['admin'], label: 'Rider Rejected / Reassign' },
    { nextStatus: 'CANCELLED', allowedRoles: ['admin'], label: 'Cancel Order' },
  ],
  ACCEPTED: [
    { nextStatus: 'ARRIVED_AT_STORE', allowedRoles: ['delivery_partner', 'admin'], label: 'Rider Arrived at Store' },
    { nextStatus: 'READY_FOR_PICKUP', allowedRoles: ['admin'], label: 'Reassign Rider' },
    { nextStatus: 'CANCELLED', allowedRoles: ['admin'], label: 'Cancel Order' },
  ],
  ARRIVED_AT_STORE: [
    { nextStatus: 'PICKED_UP', allowedRoles: ['delivery_partner', 'admin'], label: 'Verify Handover QR' },
    { nextStatus: 'READY_FOR_PICKUP', allowedRoles: ['admin'], label: 'Reassign Rider' },
  ],
  PICKED_UP: [
    { nextStatus: 'OUT_FOR_DELIVERY', allowedRoles: ['delivery_partner', 'admin'], label: 'Start Delivery' },
  ],
  OUT_FOR_DELIVERY: [
    { nextStatus: 'ARRIVED_AT_CUSTOMER', allowedRoles: ['delivery_partner', 'admin'], label: 'Arrived at Customer' },
    { nextStatus: 'CUSTOMER_UNAVAILABLE', allowedRoles: ['delivery_partner', 'admin'], label: 'Customer Unavailable' },
    { nextStatus: 'DELIVERY_FAILED', allowedRoles: ['delivery_partner', 'admin'], label: 'Delivery Failed' },
  ],
  ARRIVED_AT_CUSTOMER: [
    { nextStatus: 'DELIVERED', allowedRoles: ['delivery_partner', 'admin'], label: 'Verify Customer OTP' },
    { nextStatus: 'CUSTOMER_UNAVAILABLE', allowedRoles: ['delivery_partner', 'admin'], label: 'Customer Unavailable' },
    { nextStatus: 'DELIVERY_FAILED', allowedRoles: ['delivery_partner', 'admin'], label: 'Delivery Failed' },
  ],
  DELIVERED: [
    { nextStatus: 'COMPLETED', allowedRoles: ['admin'], label: 'Complete Order' },
  ],
  COMPLETED: [
    { nextStatus: 'REFUNDED', allowedRoles: ['admin'], label: 'Refund Order' },
    { nextStatus: 'RETURNED', allowedRoles: ['admin'], label: 'Return Order' },
  ],
};

export function canTransition(
  currentStatus: string,
  nextStatus: string,
  actorRole: UserRole
): boolean {
  const transitions = VALID_TRANSITIONS[currentStatus];
  if (!transitions) return false;
  return transitions.some(
    (t) => t.nextStatus === nextStatus && t.allowedRoles.includes(actorRole)
  );
}

export function getAvailableTransitions(
  currentStatus: string,
  actorRole: UserRole
): TransitionRule[] {
  const transitions = VALID_TRANSITIONS[currentStatus] || [];
  return transitions.filter((t) => t.allowedRoles.includes(actorRole));
}

// ══════════════════════════════════════════
// CUSTOMER-FACING STATUS CHECK HELPERS
// ══════════════════════════════════════════

export function isOrderCancellable(status: string): boolean {
  return ['CREATED', 'PAYMENT_PENDING', 'PAYMENT_FAILED', 'CONFIRMED', 'STOCK_RESERVED'].includes(status)
    || ['placed', 'accepted'].includes(status);
}

export function isOrderActive(status: string): boolean {
  return ![
    'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED',
    'delivered', 'cancelled',
  ].includes(status);
}

export function isOrderDelivered(status: string): boolean {
  return ['DELIVERED', 'COMPLETED', 'delivered'].includes(status);
}

export function isOrderCancelled(status: string): boolean {
  return ['CANCELLED', 'DELIVERY_FAILED', 'RETURNED', 'REFUNDED', 'cancelled'].includes(status);
}

export function isInDelivery(status: string): boolean {
  return [
    'ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_STORE', 'PICKED_UP',
    'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER',
    'partner_assigned', 'picked_up', 'out_for_delivery',
  ].includes(status);
}
