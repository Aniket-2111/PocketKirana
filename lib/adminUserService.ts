/**
 * PocketKirana — Admin User Provisioning & Authority Service
 *
 * Provides safe representation and role mapping for authenticated administrative identities.
 *
 * CANONICAL MAPPING:
 * Firebase authenticated identity
 *         ↓
 * Firebase UID
 *         ↓
 * admin_users.firebase_uid
 *         ↓
 * admin_users.role_id
 *         ↓
 * roles.name
 */

import { Pool } from 'pg';
import { getPostgresPool } from './postgres';

export interface AdminUserRecord {
  id: string;
  firebaseUid: string;
  roleId: string;
  roleName: string;
  employeeCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionAdminUserOptions {
  /** Verified Firebase UID from server-authenticated context ONLY */
  firebaseUid: string;
  /** Verified role from server-authenticated context ONLY */
  verifiedRole: string;
  /** Optional employee code (optional metadata, must respect UNIQUE constraint) */
  employeeCode?: string;
  /** Pool override for test database execution */
  poolOverride?: Pool;
}

export interface ProvisionAdminUserResult {
  success: boolean;
  user?: AdminUserRecord;
  error?: string;
  statusCode?: number;
}

/**
 * Valid administrative roles supported by the system.
 */
export const ALLOWED_ADMIN_ROLES = ['admin', 'store_admin', 'store_manager'] as const;

/**
 * Safely provisions or retrieves an admin user representation in PostgreSQL.
 * Fails closed on untrusted input or role mismatches.
 */
export async function provisionAdminUser(
  options: ProvisionAdminUserOptions
): Promise<ProvisionAdminUserResult> {
  const { firebaseUid, verifiedRole, employeeCode, poolOverride } = options;

  if (!firebaseUid || typeof firebaseUid !== 'string' || firebaseUid.trim() === '') {
    return {
      success: false,
      error: 'Invalid request: Verified Firebase UID is required.',
      statusCode: 400,
    };
  }

  // Verify role is an allowed administrative role
  if (!verifiedRole || !ALLOWED_ADMIN_ROLES.includes(verifiedRole as any)) {
    return {
      success: false,
      error: `Forbidden: Role '${verifiedRole}' is not an authorized administrative role.`,
      statusCode: 403,
    };
  }

  const pool = poolOverride || getPostgresPool();

  try {
    // 1. Resolve target role_id from canonical roles table
    const roleRes = await pool.query(
      `SELECT id, name FROM roles WHERE name = $1 LIMIT 1`,
      [verifiedRole]
    );

    if (!roleRes.rows || roleRes.rows.length === 0) {
      return {
        success: false,
        error: `Configuration Error: Role '${verifiedRole}' is missing from PostgreSQL roles table.`,
        statusCode: 500,
      };
    }

    const targetRoleId = roleRes.rows[0].id;

    // 2. Check if admin user already exists for this firebase_uid
    const existingRes = await pool.query(
      `SELECT au.id, au.firebase_uid, au.role_id, au.employee_code, au.is_active,
              au.created_at, au.updated_at, r.name as role_name
       FROM admin_users au
       LEFT JOIN roles r ON au.role_id = r.id
       WHERE au.firebase_uid = $1
       LIMIT 1`,
      [firebaseUid]
    );

    if (existingRes.rows && existingRes.rows.length > 0) {
      const existingUser = existingRes.rows[0];

      // Fail closed if existing role in DB conflicts with verified role
      if (existingUser.role_name && existingUser.role_name !== verifiedRole) {
        return {
          success: false,
          error: `Role Mismatch Failure: Existing admin user role '${existingUser.role_name}' conflicts with verified request role '${verifiedRole}'.`,
          statusCode: 409,
        };
      }

      return {
        success: true,
        user: {
          id: existingUser.id,
          firebaseUid: existingUser.firebase_uid,
          roleId: existingUser.role_id,
          roleName: existingUser.role_name || verifiedRole,
          employeeCode: existingUser.employee_code,
          isActive: existingUser.is_active !== false,
          createdAt: existingUser.created_at ? new Date(existingUser.created_at).toISOString() : new Date().toISOString(),
          updatedAt: existingUser.updated_at ? new Date(existingUser.updated_at).toISOString() : new Date().toISOString(),
        },
      };
    }

    // 3. Insert new admin_users record with deterministic primary key
    const id = `au_${firebaseUid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)}`;

    const insertRes = await pool.query(
      `INSERT INTO admin_users (id, firebase_uid, role_id, employee_code, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (firebase_uid) DO UPDATE
         SET updated_at = CURRENT_TIMESTAMP
       RETURNING id, firebase_uid, role_id, employee_code, is_active, created_at, updated_at`,
      [id, firebaseUid, targetRoleId, employeeCode || null]
    );

    const inserted = insertRes.rows[0];

    return {
      success: true,
      user: {
        id: inserted.id,
        firebaseUid: inserted.firebase_uid,
        roleId: inserted.role_id,
        roleName: verifiedRole,
        employeeCode: inserted.employee_code,
        isActive: inserted.is_active !== false,
        createdAt: inserted.created_at ? new Date(inserted.created_at).toISOString() : new Date().toISOString(),
        updatedAt: inserted.updated_at ? new Date(inserted.updated_at).toISOString() : new Date().toISOString(),
      },
    };
  } catch (err: any) {
    console.error('[provisionAdminUser Error]', err.message);
    return {
      success: false,
      error: `Database provisioning failure: ${err.message}`,
      statusCode: 500,
    };
  }
}
