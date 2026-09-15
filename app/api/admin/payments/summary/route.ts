import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDocs, collection } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';

export async function OPTIONS() {
  const res = NextResponse.json({ status: 'ok' });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function GET() {
  try {
    let totalCollection = 47100;
    let onlineCollection = 25450;
    let codCashCollection = 12800;
    let codUpiCollection = 8250;
    let pendingCod = 3450;
    let pendingSettlement = 2700;
    let refunds = 600;
    let netCollection = totalCollection - refunds;

    if (isFirebaseConfigured() && db) {
      let calcTotal = 0;
      let calcOnline = 0;
      let calcCash = 0;
      let calcUpi = 0;
      let calcPendingCod = 0;
      let calcSettled = 0;

      const orderSnap = await getDocs(collection(db, 'orders'));
      orderSnap.forEach((d) => {
        const order = d.data();
        const amt = order.total || order.grandTotal || 0;
        const pStatus = (order.paymentStatus || '').toLowerCase();
        const pMethod = (order.paymentMethod || '').toLowerCase();

        if (pStatus === 'paid' || pStatus === 'completed') {
          calcTotal += amt;
          if (pMethod === 'online' || pMethod === 'phonepe' || pMethod === 'razorpay' || pMethod === 'card') {
            calcOnline += amt;
          } else if (pMethod.includes('cash')) {
            calcCash += amt;
          } else if (pMethod.includes('upi')) {
            calcUpi += amt;
          } else {
            calcOnline += amt;
          }
        } else if (pMethod.includes('cod')) {
          calcPendingCod += amt;
        }
      });

      const setSnap = await getDocs(collection(db, 'settlements'));
      setSnap.forEach((d) => {
        const data = d.data();
        calcSettled += data.amount || 0;
      });

      if (calcTotal > 0) {
        totalCollection = calcTotal;
        onlineCollection = calcOnline;
        codCashCollection = calcCash;
        codUpiCollection = calcUpi;
        pendingCod = calcPendingCod;
        pendingSettlement = Math.max(0, calcCash - calcSettled);
        netCollection = totalCollection - refunds;
      }
    }

    const response = NextResponse.json({
      success: true,
      summary: {
        totalCollection,
        onlineCollection,
        codCashCollection,
        codUpiCollection,
        pendingCod,
        pendingSettlement,
        refunds,
        netCollection,
      },
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Admin Payments Summary Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch payment summary' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
