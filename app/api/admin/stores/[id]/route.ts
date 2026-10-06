import { NextResponse } from 'next/server';

/**
 * RETIRED: The legacy in-memory /api/admin/stores/[id] endpoint has been retired.
 * Store operational authority is managed via canonical /api/admin/store/operations backed by PostgreSQL.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'GONE',
      message: 'The legacy /api/admin/stores/[id] endpoint has been retired. Store operational authority is managed via canonical /api/admin/store/operations backed by PostgreSQL.',
    },
    { status: 410 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: 'GONE',
      message: 'The legacy /api/admin/stores/[id] endpoint has been retired. Store operational authority is managed via canonical /api/admin/store/operations backed by PostgreSQL.',
    },
    { status: 410 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: 'GONE',
      message: 'The legacy /api/admin/stores/[id] endpoint has been retired. Store operational authority is managed via canonical /api/admin/store/operations backed by PostgreSQL.',
    },
    { status: 410 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'GONE',
      message: 'The legacy /api/admin/stores/[id] endpoint has been retired. Store operational authority is managed via canonical /api/admin/store/operations backed by PostgreSQL.',
    },
    { status: 410 }
  );
}
