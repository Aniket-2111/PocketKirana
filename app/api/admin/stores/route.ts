import { NextRequest, NextResponse } from 'next/server';

/**
 * RETIRED: The legacy in-memory /api/admin/stores endpoint has been retired.
 * Store operational authority is managed via canonical /api/admin/store/operations backed by PostgreSQL.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'GONE',
      message: 'The legacy /api/admin/stores endpoint has been retired. Store configuration authority is consolidated under /api/admin/store/operations backed by PostgreSQL.',
    },
    { status: 410 }
  );
}

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'GONE',
      message: 'The legacy /api/admin/stores endpoint has been retired. Store configuration authority is consolidated under /api/admin/store/operations backed by PostgreSQL.',
    },
    { status: 410 }
  );
}
