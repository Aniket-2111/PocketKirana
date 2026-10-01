import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDocs, collection, doc, updateDoc, setDoc } from 'firebase/firestore';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const exceptions: any[] = [];

    if (isFirebaseConfigured() && db) {
      const snap = await getDocs(collection(db, 'deliveryExceptions'));
      snap.forEach((d) => {
        exceptions.push(d.data());
      });
    }

    return NextResponse.json({ success: true, exceptions });
  } catch (error: any) {
    console.error('[Admin Exceptions GET Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch exceptions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const body = await req.json();
    const { exceptionId, action, adminNote, orderId } = body;

    // Use verified auth context — never trust client-supplied adminId/adminName
    const adminId = auth.uid;
    const adminName = auth.name || 'Store Admin';

    if (!exceptionId || !action) {
      return NextResponse.json(
        { success: false, error: 'exceptionId and action (APPROVED | REJECTED) are required.' },
        { status: 400 }
      );
    }

    const reviewedAt = new Date().toISOString();
    const isApproved = action === 'APPROVED';

    if (isFirebaseConfigured() && db) {
      // 1. Update Exception document
      await updateDoc(doc(db, 'deliveryExceptions', exceptionId), {
        status: isApproved ? 'APPROVED' : 'REJECTED',
        reviewedByAdminId: adminId,
        reviewedByAdminName: adminName,
        reviewedAt,
        adminNote: adminNote || (isApproved ? 'Exception authorized by Admin.' : 'Exception rejected.'),
      });

      // 2. If approved, complete the order delivery with exception flag
      if (isApproved && orderId) {
        await updateDoc(doc(db, 'orders', orderId), {
          orderStatus: 'DELIVERED',
          deliveryStatus: 'DELIVERED',
          isExceptionDelivery: true,
          exceptionAuthorizedBy: adminName,
          exceptionAuthorizedAt: reviewedAt,
          deliveredAt: reviewedAt,
          updatedAt: reviewedAt,
        });

        // Audit Log
        await setDoc(doc(db, 'auditLogs', `log_exc_rev_${exceptionId}`), {
          id: `log_exc_rev_${exceptionId}`,
          action: 'DELIVERY_EXCEPTION_APPROVED',
          orderId,
          actorId: adminId,
          actorRole: 'admin',
          description: `Admin ${adminName} authorized delivery exception for Order. Note: ${adminNote || 'Authorized'}`,
          timestamp: reviewedAt,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Delivery exception ${action.toLowerCase()} successfully.`,
      exceptionId,
      status: action,
      reviewedAt,
    });
  } catch (error: any) {
    console.error('[Admin Exception Review Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to review exception' },
      { status: 500 }
    );
  }
}
