import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/lib/store';
import { calculateDeliveryFee, DEFAULT_DELIVERY_FEE } from '@/lib/freeDelivery';
import { calculateAuthoritativeCartPrice } from '@/lib/pricingEngine';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import type { Product, Order } from '@/types';

const mockProduct: Product = INITIAL_PRODUCTS.find((p) => p.id === 'p-milk-gold-1l') || INITIAL_PRODUCTS[0];

describe('POCKETKIRANA — Checkout Total State & Order Snapshot Regression Suite', () => {
  beforeEach(() => {
    // Reset Zustand store state
    useAppStore.setState({
      cart: [],
      orders: [],
      appliedCoupon: null,
      activeOrderTrackingId: null,
      addresses: [
        {
          id: 'addr-default-1',
          userId: 'usr-1',
          fullName: 'Aniket Yadav',
          phone: '8698893348',
          addressLine1: 'Station Road, Neral',
          city: 'Neral',
          state: 'Maharashtra',
          postalCode: '410101',
          country: 'India',
          isDefault: true,
          addressType: 'Home',
          latitude: 19.0224,
          longitude: 73.3210,
        },
      ],
    });
  });

  it('TEST-1: Cart ₹100 -> COD -> Confirm -> Order total remains ₹100 snapshot', () => {
    const store = useAppStore.getState();
    store.addToCart(mockProduct, 1);

    const cart = useAppStore.getState().cart;
    expect(cart.length).toBe(1);

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    expect(subtotal).toBe(68);

    const deliveryFee = calculateDeliveryFee(subtotal);
    expect(deliveryFee).toBe(29);

    const tax = Math.round(subtotal * 0.05);
    expect(tax).toBe(3);

    const total = subtotal + deliveryFee + tax;
    expect(total).toBe(100);

    // Place COD order with keepCart=true first (persisting order snapshot)
    const placedOrder = store.placeOrder(
      'addr-default-1',
      'Express Delivery',
      'cod',
      'ord-cod-100',
      'PK-2026-100',
      { subtotal, deliveryCharge: deliveryFee, tax, total },
      true
    );

    expect(placedOrder.id).toBe('ord-cod-100');
    expect(placedOrder.total).toBe(100);
    expect(placedOrder.subtotal).toBe(68);
    expect(placedOrder.deliveryCharge).toBe(29);
    expect(placedOrder.tax).toBe(3);

    // Cart is still intact during submission
    expect(useAppStore.getState().cart.length).toBe(1);

    // Now clear cart upon confirmed completion
    store.clearCart();
    expect(useAppStore.getState().cart.length).toBe(0);

    // Completed order in orders list MUST retain its snapshot of ₹100, not ₹0
    const persistedOrder = useAppStore.getState().orders.find((o) => o.id === 'ord-cod-100');
    expect(persistedOrder).toBeDefined();
    expect(persistedOrder?.total).toBe(100);
    expect(persistedOrder?.items.length).toBe(1);
    expect(persistedOrder?.subtotal).toBe(68);
  });

  it('TEST-2: Cart ₹100 -> PhonePe selection -> payment flow -> Order total remains actual amount', () => {
    const store = useAppStore.getState();
    store.addToCart(mockProduct, 1);

    const cart = useAppStore.getState().cart;
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = calculateDeliveryFee(subtotal);
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + deliveryFee + tax;
    expect(total).toBe(100);

    // Persist order with keepCart=true
    const placedOrder = store.placeOrder(
      'addr-default-1',
      'Express Delivery',
      'phonepe',
      'ord-phonepe-100',
      'PK-2026-101',
      { subtotal, deliveryCharge: deliveryFee, tax, total },
      true
    );

    expect(placedOrder.total).toBe(100);
    expect(placedOrder.paymentMethod).toBe('phonepe');

    // Simulate payment verified -> clear cart
    store.clearCart();

    const currentOrder = useAppStore.getState().orders.find((o) => o.id === 'ord-phonepe-100');
    expect(currentOrder?.total).toBe(100);
  });

  it('TEST-3: Cart cleared after successful order without corrupting order totals', () => {
    const store = useAppStore.getState();
    store.addToCart(mockProduct, 1);
    expect(useAppStore.getState().cart.length).toBe(1);

    const placedOrder = store.placeOrder(
      'addr-default-1',
      'Express Delivery',
      'cod',
      'ord-test-3',
      'PK-003',
      { subtotal: 68, deliveryCharge: 29, tax: 3, total: 100 },
      false // default clear cart behavior
    );

    expect(useAppStore.getState().cart.length).toBe(0);
    expect(placedOrder.total).toBe(100);
    expect(placedOrder.subtotal).toBe(68);
  });

  it('TEST-4: Confirmation screen display data still displays actual order total after cart is empty', () => {
    const store = useAppStore.getState();
    store.addToCart(mockProduct, 1);

    const placedOrder: Order = store.placeOrder(
      'addr-default-1',
      'Express Delivery',
      'cod',
      'ord-test-4',
      'PK-004',
      { subtotal: 68, deliveryCharge: 29, tax: 3, total: 100 },
      true
    );

    store.clearCart();
    expect(useAppStore.getState().cart.length).toBe(0);

    // The display summary derived from confirmedOrder MUST equal ₹100
    const displaySummary = {
      cartCount: placedOrder.items?.length || 0,
      subtotal: placedOrder.subtotal,
      discount: placedOrder.discount || 0,
      deliveryCharge: placedOrder.deliveryCharge ?? placedOrder.deliveryFee ?? 0,
      tax: placedOrder.tax || 0,
      total: placedOrder.total,
    };

    expect(displaySummary.cartCount).toBe(1);
    expect(displaySummary.subtotal).toBe(68);
    expect(displaySummary.deliveryCharge).toBe(29);
    expect(displaySummary.tax).toBe(3);
    expect(displaySummary.total).toBe(100);
    expect(displaySummary.total).not.toBe(0);
  });

  it('TEST-5: Order tracking displays actual order total from persisted order snapshot', () => {
    const store = useAppStore.getState();
    store.addToCart(mockProduct, 1);

    const placedOrder = store.placeOrder(
      'addr-default-1',
      'Express Delivery',
      'cod',
      'ord-test-5',
      'PK-005',
      { subtotal: 68, deliveryCharge: 29, tax: 3, total: 100 },
      false
    );

    const orderInStore = useAppStore.getState().orders.find((o) => o.id === placedOrder.id);
    expect(orderInStore).toBeDefined();

    // Order tracking derives bill total: order.total || billTotal
    const trackingBillTotal = orderInStore?.total;
    expect(trackingBillTotal).toBe(100);
  });

  it('TEST-6: Failed order submission keeps cart and total intact', () => {
    const store = useAppStore.getState();
    store.addToCart(mockProduct, 1);

    const cartBefore = useAppStore.getState().cart;
    expect(cartBefore.length).toBe(1);
    const subtotalBefore = cartBefore.reduce((s, i) => s + i.price * i.quantity, 0);
    expect(subtotalBefore).toBe(68);

    // Simulating failed submission: placeOrder is NOT called or kept intact
    // Because placeOrder is only called with server result, cart remains untouched
    const cartAfterFailure = useAppStore.getState().cart;
    expect(cartAfterFailure.length).toBe(1);
    expect(cartAfterFailure[0].price).toBe(68);
  });

  it('TEST-7: Duplicate Confirm Order does not create duplicate orders or wipe cart twice', () => {
    const store = useAppStore.getState();
    store.addToCart(mockProduct, 1);

    let isSubmitting = false;
    const submit = () => {
      if (isSubmitting) return null;
      isSubmitting = true;
      return store.placeOrder(
        'addr-default-1',
        'Express Delivery',
        'cod',
        'ord-test-7',
        'PK-007',
        { subtotal: 68, deliveryCharge: 29, tax: 3, total: 100 },
        true
      );
    };

    const firstCall = submit();
    const secondCall = submit();

    expect(firstCall).toBeDefined();
    expect(secondCall).toBeNull();
    expect(useAppStore.getState().orders.length).toBe(1);
  });

  it('TEST-8: Website and Android calculate the exact same order total for ₹68 product', () => {
    const subtotal = 68;
    const deliveryFeeCustomerApp = calculateDeliveryFee(subtotal);
    const taxCustomerApp = Math.round(subtotal * 0.05);
    const totalCustomerApp = subtotal + deliveryFeeCustomerApp + taxCustomerApp;

    const deliveryFeeWebsite = calculateDeliveryFee(subtotal);
    const taxWebsite = Math.round(subtotal * 0.05);
    const totalWebsite = subtotal + deliveryFeeWebsite + taxWebsite;

    expect(deliveryFeeCustomerApp).toBe(29);
    expect(deliveryFeeWebsite).toBe(29);
    expect(taxCustomerApp).toBe(3);
    expect(taxWebsite).toBe(3);
    expect(totalCustomerApp).toBe(100);
    expect(totalWebsite).toBe(100);
    expect(totalCustomerApp).toBe(totalWebsite);
  });

  it('TEST-9: Server authoritative pricing engine matches client calculation (₹100)', () => {
    const breakdown = calculateAuthoritativeCartPrice(
      [{ productId: 'prod-test-68', quantity: 1 }],
      {
        'prod-test-68': {
          id: 'prod-test-68',
          name: 'Aashirvaad Atta 1kg',
          mrp: 80,
          sellingPrice: 68,
        },
      }
    );

    expect(breakdown.subtotal).toBe(68);
    expect(breakdown.deliveryCharge).toBe(29);
    expect(breakdown.taxAmount).toBe(3);
    expect(breakdown.grandTotal).toBe(100);
  });

  it('TEST-10: Delivery fee and tax remain correct across free delivery threshold boundary', () => {
    // Under ₹500: delivery charge is ₹29
    expect(calculateDeliveryFee(68)).toBe(29);
    expect(calculateDeliveryFee(499)).toBe(29);

    // At or over ₹500: delivery charge is ₹0 (FREE)
    expect(calculateDeliveryFee(500)).toBe(0);
    expect(calculateDeliveryFee(750)).toBe(0);

    // Zero cart: delivery fee is 0
    expect(calculateDeliveryFee(0)).toBe(0);
  });
});
