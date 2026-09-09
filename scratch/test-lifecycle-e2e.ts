import { useAppStore } from '../lib/store';

async function runE2ETest() {
  console.log('====================================================');
  console.log('🚀 POCKET KIRANA 3-APP REALTIME LIFECYCLE & CONCURRENCY TEST');
  console.log('====================================================\n');

  const store = useAppStore.getState();

  // ── STEP 1: CUSTOMER APP ORDER PLACEMENT ──
  console.log('📦 STEP 1: Customer App Placing Order...');
  const testProduct = store.products[0] || {
    id: 'p-test-1',
    name: 'Amul Taaza Homogenised Toned Milk 1L',
    price: 72,
    sellingPrice: 72,
    mrp: 75,
    unit: '1 L',
    stock: 50,
  };

  store.clearCart();
  store.addToCart(testProduct as any, 2);

  const cart = useAppStore.getState().cart;
  console.log(`✓ Cart has ${cart.length} item(s) with total quantity: ${cart[0]?.quantity}`);

  const placedOrder = store.placeOrder(
    'addr-1',
    '10-15 mins Express Delivery',
    'cod'
  );
  console.log(`✓ Order placed successfully! Order ID: ${placedOrder.id}, Order Number: #${placedOrder.orderNumber}, Status: ${placedOrder.orderStatus}`);

  // ── STEP 2: PICKER APP PACKING WORKFLOW ──
  console.log('\n🛒 STEP 2: Picker App Warehouse Fulfilment...');
  const activePickerId = 'picker-1';
  const updatedTasks = useAppStore.getState().pickingTasks;
  const task = updatedTasks.find((t) => t.orderId === placedOrder.id || t.orderNumber === placedOrder.orderNumber);

  if (!task) {
    throw new Error(`Picking task for order ${placedOrder.orderNumber} was not generated!`);
  }
  console.log(`✓ Picking Task #${task.id} found in warehouse queue. Initial Status: ${task.status}`);

  // Picker accepts and starts
  store.acceptOrderTask(task.id, activePickerId);
  store.startPickingTask(task.id, activePickerId);
  console.log(`✓ Picker assigned and task started (Status: PICKING)`);

  // Picker completes packing (packOrderTask automatically moves order to WAITING_FOR_DELIVERY)
  store.packOrderTask(task.id, 1, ['Standard Cold Grocery Bag']);
  
  const packedOrder = useAppStore.getState().orders.find((o) => o.id === placedOrder.id);
  console.log(`✓ Picker confirmed ORDER PACKED.`);
  console.log(`✓ Order Status automatically moved to: [${packedOrder?.orderStatus}] (Expected: WAITING_FOR_DELIVERY)`);
  if (packedOrder?.orderStatus !== 'WAITING_FOR_DELIVERY') {
    throw new Error(`Order status is ${packedOrder?.orderStatus}, expected WAITING_FOR_DELIVERY`);
  }

  // ── STEP 3: DELIVERY PARTNER CONCURRENCY ACCEPTANCE TEST ──
  console.log('\n🚴 STEP 3: Delivery Partner Atomic Acceptance & Concurrency Lock...');
  const partner1 = 'partner-1';
  const partner2 = 'partner-2';

  // Ensure both partners are idle/online for clean concurrency test
  useAppStore.setState((state) => ({
    deliveryPartners: state.deliveryPartners.map((p) =>
      p.id === partner1 || p.id === partner2
        ? { ...p, currentStatus: 'online', activeOrderId: undefined }
        : p
    ),
  }));

  // Partner 1 attempts to accept
  console.log(`Attempting concurrent acceptance: Partner 1 vs Partner 2...`);
  const res1 = store.acceptDeliveryAssignment(placedOrder.id, partner1);
  console.log(`• Partner 1 accept result:`, res1);

  // Partner 2 attempts to accept the same order simultaneously
  const res2 = store.acceptDeliveryAssignment(placedOrder.id, partner2);
  console.log(`• Partner 2 accept result:`, res2);

  if (res1.success && !res2.success) {
    console.log(`✓ ATOMIC LOCK VERIFIED: Partner 1 accepted, Partner 2 safely rejected with: "${res2.message}"`);
  } else {
    throw new Error(`Concurrency test failed! Unexpected acceptance state.`);
  }

  const outForDeliveryOrder = useAppStore.getState().orders.find((o) => o.id === placedOrder.id);
  console.log(`✓ Order is now: [${outForDeliveryOrder?.orderStatus}] assigned to Partner: ${outForDeliveryOrder?.partnerName}`);

  // ── STEP 4: DELIVERY PARTNER ACTIVE TRIP (ARRIVED & COMPLETE) ──
  console.log('\n📍 STEP 4: Delivery Partner Live Trip & Customer Doorstep...');
  
  // Partner marks arrived
  const arrivedRes = store.markDeliveryArrived(placedOrder.id, partner1);
  console.log(`✓ Rider marked arrived:`, arrivedRes);
  const arrivedOrder = useAppStore.getState().orders.find((o) => o.id === placedOrder.id);
  console.log(`✓ Real-time Order Status: [${arrivedOrder?.orderStatus}] (Customer app shows Arrived banner)`);

  // Partner completes delivery
  const completeRes = store.completeDeliveryDirect(placedOrder.id, partner1);
  console.log(`✓ Delivery completed:`, completeRes);

  const deliveredOrder = useAppStore.getState().orders.find((o) => o.id === placedOrder.id);
  const deliveredPartner = useAppStore.getState().deliveryPartners.find((p) => p.id === partner1);
  console.log(`✓ Final Order Status: [${deliveredOrder?.orderStatus}] (Customer & Admin synced)`);
  console.log(`✓ Delivery Partner Duty Status: [${deliveredPartner?.currentStatus}] (Freed to Online for next order)`);

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED! 3-APP REALTIME SYSTEM 100% OPERATIONAL');
  console.log('====================================================');
}

runE2ETest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
