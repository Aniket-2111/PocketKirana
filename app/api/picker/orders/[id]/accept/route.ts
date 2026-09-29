import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';

import { getRouteAuth } from '@/lib/routeAuth';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const auth = getRouteAuth(req);
    if (auth && auth.role !== 'picker' && auth.role !== 'admin' && auth.uid !== 'dev-user') {
      return NextResponse.json({ error: 'Forbidden: Picker role required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const pickerId = auth?.uid || body.pickerId || 'picker_default';
    const pickerName = body.pickerName || (auth?.role === 'picker' ? 'Picker Staff' : 'Store Staff');

    const result = await transitionOrderStatus({
      orderId: id,
      eventType: 'PICKER_ACCEPTED',
      targetStatus: 'PICKER_ACCEPTED',
      actorId: pickerId,
      actorType: 'picker',
      metadata: {
        pickerId,
        pickerName,
        acceptedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to accept order' },
      { status: 500 }
    );
  }
}
