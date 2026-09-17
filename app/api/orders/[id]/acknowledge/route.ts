import { NextRequest, NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/postgres';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { staffId = 'staff_default', role = 'picker' } = body;

    try {
      await queryPostgres(
        `UPDATE notifications
         SET acknowledged_at = CURRENT_TIMESTAMP,
             status = 'ACKNOWLEDGED'
         WHERE order_id = $1 AND (firebase_uid = $2 OR recipient_type = $3)
           AND acknowledged_at IS NULL`,
        [id, staffId, role]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Alarm acknowledged and silenced successfully',
      orderId: id,
      acknowledgedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to acknowledge alarm' },
      { status: 500 }
    );
  }
}
