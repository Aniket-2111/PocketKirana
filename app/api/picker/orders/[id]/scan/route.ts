import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const {
      barcode,
      itemId,
      pickedQuantity,
      pickerId = 'picker_default',
      isAllPicked = false,
    } = body;

    if (!barcode && !itemId) {
      return NextResponse.json(
        { success: false, error: 'barcode or itemId is required' },
        { status: 400 }
      );
    }

    const eventResult = await transitionOrderStatus({
      orderId: id,
      eventType: isAllPicked ? 'PICKING_COMPLETED' : 'ITEM_PICKED',
      targetStatus: isAllPicked ? 'PICKING_COMPLETED' : 'PICKING_STARTED',
      actorId: pickerId,
      actorType: 'picker',
      metadata: {
        barcode,
        itemId,
        pickedQuantity,
        isAllPicked,
        scannedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        scanned: true,
        barcode,
        isAllPicked,
        transition: eventResult,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to scan item' },
      { status: 500 }
    );
  }
}
