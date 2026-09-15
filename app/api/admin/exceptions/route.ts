import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDocs, collection, doc, updateDoc, setDoc } from 'firebase/firestore';

export async function OPTIONS() {
  const res = NextResponse.json({ status: 'ok' });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function GET() {
  try {
    const exceptions: any[] = [];

    if (isFirebaseConfigured() && db) {
      const snap = await getDocs(collection(db, 'deliveryExceptions'));
      snap.forEach((d) => {
        exceptions.push(d.data());
      });
    }

    const response = NextResponse.json({
      success: true,
      exceptions,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Admin Exceptions GET Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exceptions' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { exceptionId, action, adminId, adminName, adminNote, orderId } = body;

    if (!exceptionId || !action) {
      const response = NextResponse.json(
        { success: false, error: 'exceptionId and action (APPROVED | REJECTED) are required.' },
        { status: 400 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    const reviewedAt = new Date().toISOString();
    const isApproved = action === 'APPROVED';

    if (isFirebaseConfigured() && db) {
      // 1. Update Exception document
      await updateDoc(doc(db, 'deliveryExceptions', exceptionId), {
        status: isApproved ? 'APPROVED' : 'REJECTED',
        reviewedByAdminId: adminId || 'admin-root',
        reviewedByAdminName: adminName || 'Store Admin',
        reviewedAt,
        adminNote: adminNote || (isApproved ? 'Exception authorized by Admin.' : 'Exception rejected.'),
      });

      // 2. If approved, complete the order delivery with exception flag
      if (isApproved && orderId) {
        await updateDoc(doc(db, 'orders', orderId), {
          orderStatus: 'DELIVERED',
          deliveryStatus: 'DELIVERED',
          isExceptionDelivery: true,
          exceptionAuthorizedBy: adminName || 'Admin',
          exceptionAuthorizedAt: reviewedAt,
          deliveredAt: reviewedAt,
          updatedAt: reviewedAt,
        });

        // Audit Log
        await setDoc(doc(db, 'auditLogs', `log_exc_rev_${exceptionId}`), {
          id: `log_exc_rev_${exceptionId}`,
          action: 'DELIVERY_EXCEPTION_APPROVED',
          orderId,
          actorId: adminId || 'admin-root',
          actorRole: 'admin',
          description: `Admin ${adminName || 'Admin'} authorized delivery exception for Order. Note: ${adminNote || 'Authorized'}`,
          timestamp: reviewedAt,
        });
      }
    }

    const response = NextResponse.json({
      success: true,
      message: `Delivery exception ${action.toLowerCase()} successfully.`,
      exceptionId,
      status: action,
      reviewedAt,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Admin Exception Review Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to review exception' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
