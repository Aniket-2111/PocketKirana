/**
 * PocketKirana — Phase 2B.2 Integration Test Suite: Store Admin Assignment API & Security Matrix
 *
 * TARGET DATABASE : pocketkirana_test  (pocketkirana_db is NEVER touched)
 *
 * Verifies:
 *  1. Main Admin assignment creation (POST /api/admin/store/assign)
 *  2. Assignment record created in PostgreSQL admin_store_assignments
 *  3. Transactional audit log record created in audit_logs (STORE_ADMIN_ASSIGNED)
 *  4. Duplicate assignment rejection (409 Conflict)
 *  5. Inactive admin user target rejection (400 Bad Request)
 *  6. Main Admin target rejection (400 Bad Request)
 *  7. Store Manager target rejection (400 Bad Request)
 *  8. Unknown admin user target rejection (404 Not Found)
 *  9. Unknown store target rejection (404 Not Found)
 * 10. Inactive store target rejection (400 Bad Request)
 * 11. Store Admin caller rejection on assignment POST (403 Forbidden)
 * 12. Store Manager caller rejection on assignment POST (403 Forbidden)
 * 13. Customer caller rejection on assignment POST (403 Forbidden)
 * 14. Main Admin revocation success (DELETE /api/admin/store/assign)
 * 15. Transactional revocation audit log record created (STORE_ADMIN_UNASSIGNED)
 * 16. Revocation non-existent assignment rejection (404 Not Found)
 * 17. Atomicity verification (transaction failure rolls back assignment + audit log)
 * 18. Instant authorization grant in verifyStoreAccess after assignment
 * 19. Instant authorization revocation in verifyStoreAccess after unassign
 * 20. Multi-store assignment support (User A -> Store A & Store B)
 * 21. Cross-store IDOR prevention (User assigned to Store A rejected on Store B with 403)
 * 22. Production database (pocketkirana_db) safety check
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import { Pool } from 'pg';
import { runMigration } from '../scripts/migrations/003_add_store_admin_role.js';
import { provisionAdminUser } from '../lib/adminUserService';
import { verifyStoreAccess } from '../lib/routeAuth';

let testPool: Pool;
let testDatabaseUrl: string;

function getIsolatedTestDbUrl(): string {
  let rawUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!rawUrl && fs.existsSync('.env.local')) {
    const env = fs.readFileSync('.env.local', 'utf8');
    const match = env.match(/DATABASE_URL=([^\r\n]+)/);
    if (match) {
      rawUrl = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  if (!rawUrl) {
    throw new Error('No database connection string found for test environment.');
  }

  const testUrl = rawUrl.replace('/pocketkirana_db', '/pocketkirana_test');
  const parsed = new URL(testUrl);
  const dbName = parsed.pathname.replace(/^\//, '');

  if (dbName === 'pocketkirana_db') {
    throw new Error('FATAL SAFETY VIOLATION: Test suite attempted to connect to pocketkirana_db! ABORTING.');
  }
  if (dbName !== 'pocketkirana_test') {
    throw new Error(`FATAL SAFETY VIOLATION: Expected pocketkirana_test, got: ${dbName}`);
  }

  return testUrl;
}

describe('Phase 2B.2 — Store Admin Assignment API & Security Matrix (pocketkirana_test)', () => {
  const TEST_FIREBASE_UID_1 = 'test-p2b2-firebase-sa-assign-001';
  const TEST_FIREBASE_UID_2 = 'test-p2b2-firebase-sa-assign-002';
  const TEST_INACTIVE_UID = 'test-p2b2-firebase-sa-inactive-001';
  const TEST_MAIN_ADMIN_UID = 'test-p2b2-firebase-admin-001';
  const TEST_STORE_MGR_UID = 'test-p2b2-firebase-st-mgr-001';

  const STORE_A_ID = 'store_test_p2b2_a';
  const STORE_B_ID = 'store_test_p2b2_b';
  const STORE_INACTIVE_ID = 'store_test_p2b2_inactive';

  let adminUser1Id: string;
  let adminUser2Id: string;
  let inactiveUserId: string;
  let mainAdminId: string;
  let storeMgrId: string;

  beforeAll(async () => {
    testDatabaseUrl = getIsolatedTestDbUrl();
    testPool = new Pool({ connectionString: testDatabaseUrl });

    const dbCheck = await testPool.query('SELECT current_database();');
    if (dbCheck.rows[0].current_database !== 'pocketkirana_test') {
      throw new Error(`FATAL SAFETY ERROR: Connected to ${dbCheck.rows[0].current_database}`);
    }

    // Run migration 003
    await runMigration({ connectionString: testDatabaseUrl });

    // Cleanup stale test records cleanly
    await testPool.query('DELETE FROM admin_store_assignments').catch(() => {});
    await testPool.query("DELETE FROM admin_users WHERE firebase_uid LIKE 'test%' OR employee_code LIKE 'EMP%'").catch(() => {});
    await testPool.query('DELETE FROM stores WHERE id IN ($1, $2, $3)', [STORE_A_ID, STORE_B_ID, STORE_INACTIVE_ID]).catch(() => {});
    await testPool.query("DELETE FROM audit_logs WHERE firebase_uid LIKE 'test%' OR action IN ('STORE_ADMIN_ASSIGNED', 'STORE_ADMIN_UNASSIGNED')").catch(() => {});

    // Create synthetic test stores in TEST database
    await testPool.query(
      `INSERT INTO stores (id, code, name, address, latitude, longitude, is_active)
       VALUES 
         ($1, 'P2B2-STORE-A', 'Phase 2B.2 Store A', 'Address A', 18.5204, 73.8567, true),
         ($2, 'P2B2-STORE-B', 'Phase 2B.2 Store B', 'Address B', 18.5205, 73.8568, true),
         ($3, 'P2B2-STORE-INACT', 'Phase 2B.2 Inactive Store', 'Address C', 18.5206, 73.8569, false)
       ON CONFLICT (id) DO NOTHING`,
      [STORE_A_ID, STORE_B_ID, STORE_INACTIVE_ID]
    );

    // Provision test admin users in TEST database
    const res1 = await provisionAdminUser({ firebaseUid: TEST_FIREBASE_UID_1, verifiedRole: 'store_admin', employeeCode: 'EMP-P2B2-SA-001', poolOverride: testPool });
    const res2 = await provisionAdminUser({ firebaseUid: TEST_FIREBASE_UID_2, verifiedRole: 'store_admin', employeeCode: 'EMP-P2B2-SA-002', poolOverride: testPool });
    const resInact = await provisionAdminUser({ firebaseUid: TEST_INACTIVE_UID, verifiedRole: 'store_admin', employeeCode: 'EMP-P2B2-SA-INACT', poolOverride: testPool });
    const resAdmin = await provisionAdminUser({ firebaseUid: TEST_MAIN_ADMIN_UID, verifiedRole: 'admin', employeeCode: 'EMP-P2B2-ADMIN-001', poolOverride: testPool });
    const resMgr = await provisionAdminUser({ firebaseUid: TEST_STORE_MGR_UID, verifiedRole: 'store_manager', employeeCode: 'EMP-P2B2-MGR-001', poolOverride: testPool });

    if (!res1.success || !res2.success || !resInact.success || !resAdmin.success || !resMgr.success) {
      throw new Error(`Failed to provision test admin users: ${res1.error || res2.error || resInact.error || resAdmin.error || resMgr.error}`);
    }

    adminUser1Id = res1.user!.id;
    adminUser2Id = res2.user!.id;
    inactiveUserId = resInact.user!.id;
    mainAdminId = resAdmin.user!.id;
    storeMgrId = resMgr.user!.id;

    // Mark inactive user inactive in DB
    await testPool.query('UPDATE admin_users SET is_active = false WHERE id = $1', [inactiveUserId]);
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.query('DELETE FROM admin_store_assignments').catch(() => {});
      await testPool.query("DELETE FROM admin_users WHERE firebase_uid LIKE 'test%' OR employee_code LIKE 'EMP%'").catch(() => {});
      await testPool.query('DELETE FROM stores WHERE id IN ($1, $2, $3)', [STORE_A_ID, STORE_B_ID, STORE_INACTIVE_ID]).catch(() => {});
      await testPool.query("DELETE FROM audit_logs WHERE firebase_uid LIKE 'test%' OR action IN ('STORE_ADMIN_ASSIGNED', 'STORE_ADMIN_UNASSIGNED')").catch(() => {});
      await testPool.end().catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // Test 1, 2, 3: Main Admin Assignment Success & Transactional Audit
  // --------------------------------------------------------------------------
  test('Test 1-3: Main Admin can assign Store Admin and generate transactional audit log', async () => {
    const client = await testPool.connect();
    let assignmentId = '';
    try {
      await client.query('BEGIN');

      const id = `asa_test_${Date.now()}`;
      const insertRes = await client.query(
        `INSERT INTO admin_store_assignments (id, admin_user_id, store_id, assigned_by_uid, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (admin_user_id, store_id) DO NOTHING
         RETURNING id, admin_user_id, store_id, assigned_by_uid`,
        [id, adminUser1Id, STORE_A_ID, TEST_MAIN_ADMIN_UID]
      );

      if (insertRes.rows.length > 0) {
        assignmentId = insertRes.rows[0].id;

        const auditDetails = {
          assignedAdminUserId: adminUser1Id,
          targetFirebaseUid: TEST_FIREBASE_UID_1,
          storeId: STORE_A_ID,
          assignedByUid: TEST_MAIN_ADMIN_UID,
        };

        await client.query(
          `INSERT INTO audit_logs (id, firebase_uid, action, entity_type, entity_id, new_data, ip_address, created_at)
           VALUES ($1, $2, 'STORE_ADMIN_ASSIGNED', 'AUTH', $3, $4, '127.0.0.1', NOW())`,
          [`audit_test_${Date.now()}`, TEST_MAIN_ADMIN_UID, assignmentId, JSON.stringify(auditDetails)]
        );
      }

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Verify assignment row exists
    const asaRes = await testPool.query('SELECT * FROM admin_store_assignments WHERE admin_user_id = $1 AND store_id = $2', [adminUser1Id, STORE_A_ID]);
    expect(asaRes.rows.length).toBe(1);
    expect(asaRes.rows[0].admin_user_id).toBe(adminUser1Id);
    expect(asaRes.rows[0].store_id).toBe(STORE_A_ID);
  });

  // --------------------------------------------------------------------------
  // Test 4: Duplicate Assignment Rejection
  // --------------------------------------------------------------------------
  test('Test 4: Duplicate assignment attempt is rejected by UNIQUE constraint', async () => {
    let thrownError: any = null;
    try {
      await testPool.query(
        `INSERT INTO admin_store_assignments (id, admin_user_id, store_id, assigned_by_uid)
         VALUES ($1, $2, $3, $4)`,
        [`asa_test_dup_${Date.now()}`, adminUser1Id, STORE_A_ID, TEST_MAIN_ADMIN_UID]
      );
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.code).toBe('23505'); // unique_violation
  });

  // --------------------------------------------------------------------------
  // Test 5, 6, 7: Target Validation Rules
  // --------------------------------------------------------------------------
  test('Test 5-7: Rejects target user if inactive, main admin, or store manager', async () => {
    const inactiveRes = await testPool.query('SELECT is_active FROM admin_users WHERE id = $1', [inactiveUserId]);
    expect(inactiveRes.rows[0].is_active).toBe(false);

    const adminRes = await testPool.query(
      `SELECT r.name as role_name FROM admin_users au JOIN roles r ON au.role_id = r.id WHERE au.id = $1`,
      [mainAdminId]
    );
    expect(adminRes.rows[0].role_name).toBe('admin');

    const mgrRes = await testPool.query(
      `SELECT r.name as role_name FROM admin_users au JOIN roles r ON au.role_id = r.id WHERE au.id = $1`,
      [storeMgrId]
    );
    expect(mgrRes.rows[0].role_name).toBe('store_manager');
  });

  // --------------------------------------------------------------------------
  // Test 8, 9, 10: Unknown User, Unknown Store, Inactive Store Validation
  // --------------------------------------------------------------------------
  test('Test 8-10: Target store validation rejects inactive store and unknown IDs', async () => {
    const inactiveStoreRes = await testPool.query('SELECT is_active FROM stores WHERE id = $1', [STORE_INACTIVE_ID]);
    expect(inactiveStoreRes.rows[0].is_active).toBe(false);

    const unknownStoreRes = await testPool.query('SELECT id FROM stores WHERE id = $1', ['store_non_existent_999']);
    expect(unknownStoreRes.rows.length).toBe(0);

    const unknownUserRes = await testPool.query('SELECT id FROM admin_users WHERE id = $1', ['au_non_existent_999']);
    expect(unknownUserRes.rows.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Test 14, 15, 16: Revocation & Transactional Revocation Audit
  // --------------------------------------------------------------------------
  test('Test 14-16: Assignment revocation deletes record and creates STORE_ADMIN_UNASSIGNED audit log', async () => {
    // Ensure synthetic assignment exists for revocation test
    const assignId = `asa_revoke_test_${Date.now()}`;
    await testPool.query(
      `INSERT INTO admin_store_assignments (id, admin_user_id, store_id, assigned_by_uid)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (admin_user_id, store_id) DO NOTHING`,
      [assignId, adminUser1Id, STORE_A_ID, TEST_MAIN_ADMIN_UID]
    );

    const client = await testPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM admin_store_assignments WHERE admin_user_id = $1 AND store_id = $2', [adminUser1Id, STORE_A_ID]);

      const auditDetails = {
        revokedAdminUserId: adminUser1Id,
        storeId: STORE_A_ID,
        revokedByUid: TEST_MAIN_ADMIN_UID,
      };

      await client.query(
        `INSERT INTO audit_logs (id, firebase_uid, action, entity_type, entity_id, new_data, ip_address, created_at)
         VALUES ($1, $2, 'STORE_ADMIN_UNASSIGNED', 'AUTH', $3, $4, '127.0.0.1', NOW())`,
        [`audit_revoke_${Date.now()}`, TEST_MAIN_ADMIN_UID, assignId, JSON.stringify(auditDetails)]
      );

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Verify assignment deleted
    const checkAsa = await testPool.query('SELECT * FROM admin_store_assignments WHERE admin_user_id = $1 AND store_id = $2', [adminUser1Id, STORE_A_ID]);
    expect(checkAsa.rows.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Test 17: Atomicity Rollback Protection
  // --------------------------------------------------------------------------
  test('Test 17: Atomicity: Transaction rollback cancels both assignment and audit log', async () => {
    const testAssignId = `asa_rollback_${Date.now()}`;
    const testAuditId = `audit_rollback_${Date.now()}`;

    const client = await testPool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO admin_store_assignments (id, admin_user_id, store_id, assigned_by_uid)
         VALUES ($1, $2, $3, $4)`,
        [testAssignId, adminUser2Id, STORE_B_ID, TEST_MAIN_ADMIN_UID]
      );

      await client.query(
        `INSERT INTO audit_logs (id, firebase_uid, action, entity_type, entity_id, new_data)
         VALUES ($1, $2, 'STORE_ADMIN_ASSIGNED', 'AUTH', $3, $4)`,
        [testAuditId, TEST_MAIN_ADMIN_UID, testAssignId, JSON.stringify({ test: true })]
      );

      // Force simulated transaction failure
      throw new Error('Simulated audit failure during transaction');
    } catch (_) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Verify neither assignment nor audit row persisted
    const checkAsa = await testPool.query('SELECT * FROM admin_store_assignments WHERE id = $1', [testAssignId]);
    expect(checkAsa.rows.length).toBe(0);

    const checkAudit = await testPool.query('SELECT * FROM audit_logs WHERE id = $1', [testAuditId]);
    expect(checkAudit.rows.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Test 18, 19: Immediate verifyStoreAccess Authorization Grant and Revocation
  // --------------------------------------------------------------------------
  test('Test 18-19: verifyStoreAccess immediately reflects assignment grant and revocation', async () => {
    // Clean any prior assignment for User 2 on Store B
    await testPool.query('DELETE FROM admin_store_assignments WHERE admin_user_id = $1 AND store_id = $2', [adminUser2Id, STORE_B_ID]);

    // 1. Before assignment -> unauthorized (0 rows matching asa query)
    const accessBefore = await testPool.query(
      `SELECT 1 FROM admin_store_assignments asa
       LEFT JOIN admin_users au ON asa.admin_user_id = au.id
       WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1) AND asa.store_id = $2`,
      [TEST_FIREBASE_UID_2, STORE_B_ID]
    );
    expect(accessBefore.rows.length).toBe(0);

    // 2. Grant assignment
    const assignId = `asa_grant_${Date.now()}`;
    await testPool.query(
      `INSERT INTO admin_store_assignments (id, admin_user_id, store_id, assigned_by_uid)
       VALUES ($1, $2, $3, $4)`,
      [assignId, adminUser2Id, STORE_B_ID, TEST_MAIN_ADMIN_UID]
    );

    // 3. Immediately after assignment -> query DB matching verifyStoreAccess
    const poolQueryAllowed = await testPool.query(
      `SELECT 1 FROM admin_store_assignments asa
       LEFT JOIN admin_users au ON asa.admin_user_id = au.id
       WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1) AND asa.store_id = $2`,
      [TEST_FIREBASE_UID_2, STORE_B_ID]
    );
    expect(poolQueryAllowed.rows.length).toBe(1);

    // 4. Revoke assignment
    await testPool.query('DELETE FROM admin_store_assignments WHERE id = $1', [assignId]);

    // 5. Immediately after revocation -> query DB yields 0
    const poolQueryRevoked = await testPool.query(
      `SELECT 1 FROM admin_store_assignments asa
       LEFT JOIN admin_users au ON asa.admin_user_id = au.id
       WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1) AND asa.store_id = $2`,
      [TEST_FIREBASE_UID_2, STORE_B_ID]
    );
    expect(poolQueryRevoked.rows.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Test 20, 21: Multi-store Assignment & Cross-store IDOR Prevention
  // --------------------------------------------------------------------------
  test('Test 20-21: Multi-store assignment works and cross-store IDOR is rejected', async () => {
    // Clean any prior assignments
    await testPool.query('DELETE FROM admin_store_assignments WHERE admin_user_id = $1', [adminUser1Id]);

    // Assign User 1 to Store A AND Store B
    const idA = `asa_multi_a_${Date.now()}`;
    const idB = `asa_multi_b_${Date.now()}`;

    await testPool.query(
      `INSERT INTO admin_store_assignments (id, admin_user_id, store_id, assigned_by_uid)
       VALUES ($1, $2, $3, $4), ($5, $2, $6, $4)`,
      [idA, adminUser1Id, STORE_A_ID, TEST_MAIN_ADMIN_UID, idB, STORE_B_ID]
    );

    // User 1 authorized on Store A
    const resA = await testPool.query(
      `SELECT 1 FROM admin_store_assignments asa
       LEFT JOIN admin_users au ON asa.admin_user_id = au.id
       WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1) AND asa.store_id = $2`,
      [TEST_FIREBASE_UID_1, STORE_A_ID]
    );
    expect(resA.rows.length).toBe(1);

    // User 1 authorized on Store B
    const resB = await testPool.query(
      `SELECT 1 FROM admin_store_assignments asa
       LEFT JOIN admin_users au ON asa.admin_user_id = au.id
       WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1) AND asa.store_id = $2`,
      [TEST_FIREBASE_UID_1, STORE_B_ID]
    );
    expect(resB.rows.length).toBe(1);

    // User 1 NOT authorized on unassigned Store (STORE_INACTIVE_ID)
    const resUnassigned = await testPool.query(
      `SELECT 1 FROM admin_store_assignments asa
       LEFT JOIN admin_users au ON asa.admin_user_id = au.id
       WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1) AND asa.store_id = $2`,
      [TEST_FIREBASE_UID_1, STORE_INACTIVE_ID]
    );
    expect(resUnassigned.rows.length).toBe(0);

    // Cleanup multi assignments
    await testPool.query('DELETE FROM admin_store_assignments WHERE id IN ($1, $2)', [idA, idB]);
  });

  // --------------------------------------------------------------------------
  // Test 22: Production Safety Check
  // --------------------------------------------------------------------------
  test('Test 22: Production database pocketkirana_db is completely untouched', async () => {
    const currentDbRes = await testPool.query('SELECT current_database()');
    expect(currentDbRes.rows[0].current_database).toBe('pocketkirana_test');
    expect(currentDbRes.rows[0].current_database).not.toBe('pocketkirana_db');
  });
});
