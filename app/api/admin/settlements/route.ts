import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDocs, collection, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';

export async function OPTIONS() {
  const res = NextResponse.json({ status: 'ok' });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const ledgers: Record<string, any> = {};
    const settlements: any[] = [];

    // Fallback seed data
    ledgers['partner-1'] = {
      partnerId: 'partner-1',
      partnerName: 'Sunil Kumar',
      phone: '+91 98765 43210',
      totalCashCollected: 8500,
      totalUpiCollected: 4200,
      totalCollected: 12700,
      totalSettled: 10000,
      pendingSettlement: 2700,
      lastSettledAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    };

    ledgers['partner-2'] = {
      partnerId: 'partner-2',
      partnerName: 'Rahul Shinde',
      phone: '+91 98765 43211',
      totalCashCollected: 4300,
      totalUpiCollected: 2100,
      totalCollected: 6400,
      totalSettled: 4300,
      pendingSettlement: 2100,
      lastSettledAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    };

    if (isFirebaseConfigured() && db) {
      // Read codCollections and settlements from Firestore
      const codSnap = await getDocs(collection(db, 'codCollections'));
      codSnap.forEach((d) => {
        const data = d.data();
        const pId = data.partnerId || 'partner-1';
        if (!ledgers[pId]) {
          ledgers[pId] = {
            partnerId: pId,
            partnerName: data.partnerName || 'Partner',
            totalCashCollected: 0,
            totalUpiCollected: 0,
            totalCollected: 0,
            totalSettled: 0,
            pendingSettlement: 0,
          };
        }
        if (data.method === 'CASH') {
          ledgers[pId].totalCashCollected += data.collectedAmount || 0;
        } else {
          ledgers[pId].totalUpiCollected += data.collectedAmount || 0;
        }
        ledgers[pId].totalCollected += data.collectedAmount || 0;
        ledgers[pId].totalSettled += data.settledAmount || 0;
        ledgers[pId].pendingSettlement = Math.max(0, ledgers[pId].totalCashCollected - ledgers[pId].totalSettled);
      });

      const setSnap = await getDocs(collection(db, 'settlements'));
      setSnap.forEach((d) => {
        settlements.push(d.data());
      });
    }

    const response = NextResponse.json({
      success: true,
      ledgers: Object.values(ledgers),
      settlements,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Admin Settlements GET Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch settlements' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { partnerId, amount, adminId, adminName, settlementRef, note } = body;

    if (!partnerId || !amount || amount <= 0) {
      const response = NextResponse.json(
        { success: false, error: 'Valid partnerId and positive amount are required.' },
        { status: 400 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    const settlementId = `stl_${partnerId}_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const cleanRef = settlementRef || `STL-REF-${Date.now().toString().slice(-6)}`;

    const record = {
      id: settlementId,
      partnerId,
      partnerName: body.partnerName || 'Partner',
      amount: Number(amount),
      adminId: adminId || 'admin-root',
      adminName: adminName || 'Store Admin',
      settlementRef: cleanRef,
      note: note || 'Cash handover received and verified.',
      timestamp,
    };

    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'settlements', settlementId), record);

      // Audit Log
      await setDoc(doc(db, 'auditLogs', `log_stl_${settlementId}`), {
        id: `log_stl_${settlementId}`,
        action: 'SETTLEMENT_CONFIRMED',
        actorId: adminId || 'admin-root',
        actorRole: 'admin',
        amount: Number(amount),
        description: `Admin ${adminName || 'Admin'} confirmed COD Cash settlement of ₹${amount} for Delivery Partner ${body.partnerName || partnerId}. Ref: ${cleanRef}`,
        timestamp,
      });
    }

    const response = NextResponse.json({
      success: true,
      message: `Settlement of ₹${amount} confirmed successfully!`,
      settlementId,
      data: record,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Admin Settlement Confirm Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to confirm settlement' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
