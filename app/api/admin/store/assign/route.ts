/**
 * PocketKirana — Store Admin Assignment API
 *
 * REST Endpoints:
 *  - POST   /api/admin/store/assign : Assign a Store Admin to a Store
 *  - DELETE /api/admin/store/assign : Revoke a Store Admin assignment
 *  - GET    /api/admin/store/assign : List store assignments & eligible candidate store admins
 *
 * SECURITY:
 *  - Gated strictly to Main Admin ('admin' role).
 *  - Non-admin callers receive 403 Forbidden.
 *  - Assigned-by identity is derived strictly from server-verified authentication context.
 *  - Transactional audit logging (STORE_ADMIN_ASSIGNED, STORE_ADMIN_UNASSIGNED) executed
 *    inside the same ACID transaction block as assignment DML.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { getPostgresPool } from '@/lib/postgres';
import { randomUUID } from 'crypto';

export interface AssignRequestBody {
  adminUserId?: string;
  storeId?: string;
}

export interface RevokeRequestBody {
  adminUserId?: string;
  storeId?: string;
}

/**
 * POST /api/admin/store/assign
 * Assigns an active Store Admin to an active Store.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = requireRole(req, ['admin']);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Main Admin authority required to manage store assignments.' },
      { status: 403 }
    );
  }

  const assignedByUid = auth.uid;

  let body: AssignRequestBody = {};
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ success: false, error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { adminUserId, storeId } = body;

  if (!adminUserId || typeof adminUserId !== 'string' || adminUserId.trim() === '') {
    return NextResponse.json({ success: false, error: 'Invalid request: adminUserId is required.' }, { status: 400 });
  }

  if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
    return NextResponse.json({ success: false, error: 'Invalid request: storeId is required.' }, { status: 400 });
  }

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Validate Target Admin User
    const userRes = await client.query(
      `SELECT au.id, au.firebase_uid, au.is_active, r.name as role_name
       FROM admin_users au
       LEFT JOIN roles r ON au.role_id = r.id
       WHERE au.id = $1 OR au.firebase_uid = $1
       FOR UPDATE`,
      [adminUserId.trim()]
    );

    if (!userRes.rows || userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Admin user not found.' }, { status: 404 });
    }

    const targetUser = userRes.rows[0];

    if (targetUser.is_active === false) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Cannot assign inactive admin user.' }, { status: 400 });
    }

    if (targetUser.role_name === 'admin') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Main Admin has global authority and does not require store assignments.' },
        { status: 400 }
      );
    }

    if (targetUser.role_name === 'store_manager') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Store Managers cannot be assigned through Store Admin assignments.' },
        { status: 400 }
      );
    }

    if (targetUser.role_name !== 'store_admin') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: `Target user role '${targetUser.role_name}' is not eligible for store admin assignment.` },
        { status: 400 }
      );
    }

    const canonicalAdminUserId = targetUser.id;

    // 2. Validate Target Store
    const storeRes = await client.query(
      `SELECT id, code, is_active FROM stores
       WHERE id = $1 OR UPPER(code) = UPPER($1)
       LIMIT 1`,
      [storeId.trim()]
    );

    if (!storeRes.rows || storeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Target store not found.' }, { status: 404 });
    }

    const targetStore = storeRes.rows[0];

    if (targetStore.is_active === false) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Cannot assign Store Admin to an inactive store.' }, { status: 400 });
    }

    const canonicalStoreId = targetStore.id;

    // 3. Pre-check Duplicate Assignment
    const dupRes = await client.query(
      `SELECT id FROM admin_store_assignments
       WHERE admin_user_id = $1 AND store_id = $2
       LIMIT 1`,
      [canonicalAdminUserId, canonicalStoreId]
    );

    if (dupRes.rows && dupRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Store assignment already exists.' }, { status: 409 });
    }

    // 4. Create Assignment Record
    const assignmentId = `asa_${randomUUID().replace(/-/g, '').slice(0, 32)}`;
    const insertRes = await client.query(
      `INSERT INTO admin_store_assignments (id, admin_user_id, store_id, assigned_by_uid, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, admin_user_id, store_id, assigned_by_uid, created_at`,
      [assignmentId, canonicalAdminUserId, canonicalStoreId, assignedByUid]
    );

    const createdAssignment = insertRes.rows[0];

    // 5. Transactional Audit Log Entry (STORE_ADMIN_ASSIGNED)
    const auditId = randomUUID();
    const auditDetails = {
      assignedAdminUserId: canonicalAdminUserId,
      targetFirebaseUid: targetUser.firebase_uid,
      storeId: canonicalStoreId,
      storeCode: targetStore.code,
      assignedByUid,
      timestamp: new Date().toISOString(),
    };

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    await client.query(
      `INSERT INTO audit_logs (id, firebase_uid, action, entity_type, entity_id, new_data, ip_address, created_at)
       VALUES ($1, $2, 'STORE_ADMIN_ASSIGNED', 'AUTH', $3, $4, $5, NOW())`,
      [auditId, assignedByUid, assignmentId, JSON.stringify(auditDetails), ipAddress]
    );

    await client.query('COMMIT');

    return NextResponse.json(
      {
        success: true,
        assignment: {
          id: createdAssignment.id,
          adminUserId: createdAssignment.admin_user_id,
          targetFirebaseUid: targetUser.firebase_uid,
          storeId: createdAssignment.store_id,
          storeCode: targetStore.code,
          assignedByUid: createdAssignment.assigned_by_uid,
          createdAt: createdAssignment.created_at ? new Date(createdAssignment.created_at).toISOString() : new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});

    // Unique constraint violation check
    if (err.code === '23505') {
      return NextResponse.json({ success: false, error: 'Store assignment already exists.' }, { status: 409 });
    }

    console.error('[POST /api/admin/store/assign Error]', err.message);
    return NextResponse.json({ success: false, error: `Failed to create store assignment: ${err.message}` }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/admin/store/assign
 * Revokes an existing Store Admin store assignment.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = requireRole(req, ['admin']);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Main Admin authority required to manage store assignments.' },
      { status: 403 }
    );
  }

  const revokedByUid = auth.uid;

  let body: RevokeRequestBody = {};
  const searchParams = req.nextUrl.searchParams;

  const paramAdminUserId = searchParams.get('adminUserId');
  const paramStoreId = searchParams.get('storeId');

  if (paramAdminUserId && paramStoreId) {
    body = { adminUserId: paramAdminUserId, storeId: paramStoreId };
  } else {
    try {
      body = await req.json();
    } catch (_) {}
  }

  const { adminUserId, storeId } = body;

  if (!adminUserId || typeof adminUserId !== 'string' || adminUserId.trim() === '') {
    return NextResponse.json({ success: false, error: 'Invalid request: adminUserId is required.' }, { status: 400 });
  }

  if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
    return NextResponse.json({ success: false, error: 'Invalid request: storeId is required.' }, { status: 400 });
  }

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Locate Assignment
    const findRes = await client.query(
      `SELECT asa.id, asa.admin_user_id, asa.store_id, au.firebase_uid, s.code as store_code
       FROM admin_store_assignments asa
       LEFT JOIN admin_users au ON asa.admin_user_id = au.id
       LEFT JOIN stores s ON asa.store_id = s.id
       WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1)
         AND (asa.store_id = $2 OR UPPER(s.code) = UPPER($2))
       FOR UPDATE`,
      [adminUserId.trim(), storeId.trim()]
    );

    if (!findRes.rows || findRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Assignment not found.' }, { status: 404 });
    }

    const assignment = findRes.rows[0];

    // 2. Delete Assignment
    await client.query('DELETE FROM admin_store_assignments WHERE id = $1', [assignment.id]);

    // 3. Transactional Audit Log Entry (STORE_ADMIN_UNASSIGNED)
    const auditId = randomUUID();
    const auditDetails = {
      revokedAdminUserId: assignment.admin_user_id,
      targetFirebaseUid: assignment.firebase_uid,
      storeId: assignment.store_id,
      storeCode: assignment.store_code,
      revokedByUid,
      timestamp: new Date().toISOString(),
    };

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    await client.query(
      `INSERT INTO audit_logs (id, firebase_uid, action, entity_type, entity_id, new_data, ip_address, created_at)
       VALUES ($1, $2, 'STORE_ADMIN_UNASSIGNED', 'AUTH', $3, $4, $5, NOW())`,
      [auditId, revokedByUid, assignment.id, JSON.stringify(auditDetails), ipAddress]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Store Admin assignment revoked successfully.',
      revokedAssignmentId: assignment.id,
    });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DELETE /api/admin/store/assign Error]', err.message);
    return NextResponse.json({ success: false, error: `Failed to revoke store assignment: ${err.message}` }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * GET /api/admin/store/assign
 * Lists current store assignments and eligible Store Admin candidate profiles.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = requireRole(req, ['admin']);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Main Admin authority required to list store assignments.' },
      { status: 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const storeIdParam = searchParams.get('storeId')?.trim() || null;
  const adminUserIdParam = searchParams.get('adminUserId')?.trim() || null;
  const includeCandidates = searchParams.get('includeCandidates') === 'true';

  const pool = getPostgresPool();

  try {
    const assignmentsRes = await pool.query(
      `SELECT 
         asa.id,
         asa.admin_user_id,
         asa.store_id,
         asa.assigned_by_uid,
         asa.created_at,
         au.firebase_uid,
         au.employee_code,
         au.is_active as user_is_active,
         s.code as store_code,
         s.name as store_name,
         s.is_active as store_is_active
       FROM admin_store_assignments asa
       JOIN admin_users au ON asa.admin_user_id = au.id
       JOIN stores s ON asa.store_id = s.id
       WHERE ($1::text IS NULL OR asa.store_id = $1 OR UPPER(s.code) = UPPER($1))
         AND ($2::text IS NULL OR asa.admin_user_id = $2 OR au.firebase_uid = $2)
       ORDER BY asa.created_at DESC`,
      [storeIdParam, adminUserIdParam]
    );

    const assignments = (assignmentsRes.rows || []).map((row) => ({
      id: row.id,
      adminUserId: row.admin_user_id,
      firebaseUid: row.firebase_uid,
      employeeCode: row.employee_code,
      userIsActive: row.user_is_active !== false,
      storeId: row.store_id,
      storeCode: row.store_code,
      storeName: row.store_name,
      storeIsActive: row.store_is_active !== false,
      assignedByUid: row.assigned_by_uid,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    }));

    let candidates: any[] = [];
    if (includeCandidates) {
      const candidatesRes = await pool.query(
        `SELECT au.id, au.firebase_uid, au.employee_code, au.is_active, r.name as role_name
         FROM admin_users au
         JOIN roles r ON au.role_id = r.id
         WHERE r.name = 'store_admin' AND au.is_active = true
         ORDER BY au.created_at DESC`
      );

      candidates = (candidatesRes.rows || []).map((row) => ({
        id: row.id,
        firebaseUid: row.firebase_uid,
        employeeCode: row.employee_code,
        roleName: row.role_name,
        isActive: row.is_active !== false,
      }));
    }

    return NextResponse.json({
      success: true,
      assignments,
      candidates,
    });
  } catch (err: any) {
    console.error('[GET /api/admin/store/assign Error]', err.message);
    return NextResponse.json({ success: false, error: `Failed to fetch store assignments: ${err.message}` }, { status: 500 });
  }
}
