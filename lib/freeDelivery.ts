import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from './store';

/**
 * Authoritative Free Delivery Threshold for PocketKirana
 */
export const FREE_DELIVERY_THRESHOLD = 500;
export const DEFAULT_DELIVERY_FEE = 29;

export type FreeDeliveryState = 'BELOW_THRESHOLD' | 'NEAR_THRESHOLD' | 'UNLOCKED';

export interface FreeDeliveryStatus {
  threshold: number;
  subtotal: number;
  remainingAmount: number;
  progress: number; // 0 to 1
  isUnlocked: boolean;
  deliveryFee: number;
  state: FreeDeliveryState;
  title: string;
  subtitle: string;
  accessibilityLabel: string;
}

/**
 * Calculate authoritative delivery fee based on cart subtotal
 */
export function calculateDeliveryFee(subtotal: number): number {
  if (subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD) {
    return 0;
  }
  return DEFAULT_DELIVERY_FEE;
}

/**
 * Pure function to calculate free delivery progress and display texts
 */
export function calculateFreeDeliveryProgress(subtotal: number): FreeDeliveryStatus {
  const cleanSubtotal = Math.max(0, typeof subtotal === 'number' && !isNaN(subtotal) ? subtotal : 0);
  const isUnlocked = cleanSubtotal >= FREE_DELIVERY_THRESHOLD;
  const remainingAmount = Math.max(0, FREE_DELIVERY_THRESHOLD - cleanSubtotal);
  const progress = Math.min(cleanSubtotal / FREE_DELIVERY_THRESHOLD, 1);
  const deliveryFee = calculateDeliveryFee(cleanSubtotal);

  let state: FreeDeliveryState = 'BELOW_THRESHOLD';
  let title = 'Get FREE delivery';
  let subtitle = `on your order above ₹${FREE_DELIVERY_THRESHOLD}`;
  let accessibilityLabel = `Free delivery threshold is ₹${FREE_DELIVERY_THRESHOLD}. Add products worth ₹${remainingAmount} to qualify for free delivery.`;

  if (isUnlocked) {
    state = 'UNLOCKED';
    title = 'FREE delivery unlocked!';
    subtitle = 'Your order qualifies for free delivery';
    accessibilityLabel = 'Free delivery unlocked for this order.';
  } else if (cleanSubtotal > 0) {
    state = cleanSubtotal >= 350 ? 'NEAR_THRESHOLD' : 'BELOW_THRESHOLD';
    title = 'Get FREE delivery';
    subtitle = `Add products worth ₹${remainingAmount} more`;
    accessibilityLabel = `Free delivery. Add products worth ${remainingAmount} rupees more to unlock free delivery.`;
  }

  return {
    threshold: FREE_DELIVERY_THRESHOLD,
    subtotal: cleanSubtotal,
    remainingAmount,
    progress,
    isUnlocked,
    deliveryFee,
    state,
    title,
    subtitle,
    accessibilityLabel,
  };
}

/**
 * React hook to synchronize Free Delivery progress with the authoritative Zustand cart store
 * Includes edge-triggered celebration state that fires ONLY when subtotal crosses <500 -> >=500.
 */
export function useFreeDeliveryProgress() {
  const cart = useAppStore((state) => state.cart);
  const [mounted, setMounted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute subtotal from cart items
  const subtotal = useMemo(() => {
    if (!cart || !Array.isArray(cart)) return 0;
    return cart.reduce((sum, item) => {
      const price = typeof item.price === 'number' ? item.price : 0;
      const qty = typeof item.quantity === 'number' ? item.quantity : 1;
      return sum + price * qty;
    }, 0);
  }, [cart]);

  const prevSubtotalRef = useRef<number | null>(null);
  const status = useMemo(() => calculateFreeDeliveryProgress(subtotal), [subtotal]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Threshold crossing watcher (fires fireworks only when moving from below threshold to >= threshold)
  useEffect(() => {
    if (!mounted) return;

    const prev = prevSubtotalRef.current;
    prevSubtotalRef.current = subtotal;

    // Only fire when there was a previous state below threshold and now at/above threshold
    if (prev !== null && prev < FREE_DELIVERY_THRESHOLD && subtotal >= FREE_DELIVERY_THRESHOLD) {
      setShowCelebration(true);

      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }

      celebrationTimerRef.current = setTimeout(() => {
        setShowCelebration(false);
      }, 1500);
    } else if (subtotal < FREE_DELIVERY_THRESHOLD) {
      setShowCelebration(false);
    }

    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, [subtotal, mounted]);

  return {
    ...status,
    mounted,
    showCelebration,
  };
}
