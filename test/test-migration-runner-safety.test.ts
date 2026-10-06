import { describe, it, expect, vi } from 'vitest';
import {
  validateTestDatabaseUrl,
  extractBaselineSchemaSql,
  getMigration001Sql,
  getMigration002Sql,
  verifyTestSchema
} from '../scripts/init_test_postgres_tables.js';

describe('Phase 2.9B.5-H: Fail-Closed Test Migration Runner Authoritative Architecture Audit', () => {
  it('Test 1: Authoritative baseline SQL is loaded and non-empty', () => {
    const sql = extractBaselineSchemaSql();
    expect(sql).toBeDefined();
    expect(typeof sql).toBe('string');
    expect(sql.length).toBeGreaterThan(20000);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS categories');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS orders');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS outbox_events');
  });

  it('Test 2: Authoritative Migration 001 migrationSql is loaded', () => {
    const sql = getMigration001Sql();
    expect(sql).toBeDefined();
    expect(typeof sql).toBe('string');
    expect(sql).toContain('delivery_radius_km');
    expect(sql).toContain('max_road_distance_km');
    expect(sql).toContain('opening_time');
    expect(sql).toContain('minimum_order_value');
  });

  it('Test 3: Authoritative Migration 002 migrationSql is loaded', () => {
    const sql = getMigration002Sql();
    expect(sql).toBeDefined();
    expect(typeof sql).toBe('string');
    expect(sql).toContain('free_delivery_enabled');
    expect(sql).toContain('delivery_fee_tiers');
    expect(sql).toContain('check_store_delivery_radius');
    expect(sql).toContain('check_store_free_delivery_threshold');
    expect(sql).toContain('idx_orders_store_id');
    expect(sql).toContain('admin_store_assignments');
  });

  it('Test 4: Valid pocketkirana_test URL is accepted', () => {
    const validUrl = 'postgresql://pk_app_user:secret_pass@127.0.0.1:5433/pocketkirana_test';
    const config = validateTestDatabaseUrl(validUrl) as { database: string; host: string; port: number; user: string };

    expect(config).toBeDefined();
    expect(config.database).toBe('pocketkirana_test');
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(5433);
    expect(config.user).toBe('pk_app_user');
  });

  it('Test 5: Production pocketkirana_db is strictly rejected', () => {
    const prodUrl = 'postgresql://pk_app_user:secret_pass@127.0.0.1:5433/pocketkirana_db';

    expect(() => {
      validateTestDatabaseUrl(prodUrl);
    }).toThrowError(/FATAL SAFETY VIOLATION: Test migration attempted to target production database \(pocketkirana_db\)!/);
  });

  it('Test 6: Missing DATABASE_URL_TEST is strictly rejected', () => {
    expect(() => {
      validateTestDatabaseUrl(undefined);
    }).toThrowError(/DATABASE_URL_TEST is required/);

    expect(() => {
      validateTestDatabaseUrl('');
    }).toThrowError(/DATABASE_URL_TEST is required/);
  });

  it('Test 7: Malformed database URL is strictly rejected', () => {
    expect(() => {
      validateTestDatabaseUrl('not-a-valid-url');
    }).toThrowError(/Malformed test database URL/);

    expect(() => {
      validateTestDatabaseUrl('http://192.168.0.105:5433/pocketkirana_test');
    }).toThrowError(/Invalid protocol 'http:', expected postgres: or postgresql:/);
  });

  it('Test 8: Unexpected database name is strictly rejected', () => {
    const otherUrl = 'postgresql://pk_app_user:secret_pass@192.168.0.105:5433/some_random_db';

    expect(() => {
      validateTestDatabaseUrl(otherUrl);
    }).toThrowError(/Test migration target must be exactly 'pocketkirana_test', got: 'some_random_db'/);
  });

  it('Test 9: Schema verification logic validates complete schema requirements', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation((queryStr: string) => {
        if (queryStr.includes('SELECT current_database()')) {
          return Promise.resolve({ rows: [{ current_database: 'pocketkirana_test' }] });
        }
        if (queryStr.includes('FROM pg_tables')) {
          return Promise.resolve({
            rows: [
              { tablename: 'stores' },
              { tablename: 'orders' },
              { tablename: 'order_items' },
              { tablename: 'order_status_history' },
              { tablename: 'payments' },
              { tablename: 'payment_transactions' },
              { tablename: 'outbox_events' },
              { tablename: 'audit_logs' },
              { tablename: 'admin_store_assignments' }
            ]
          });
        }
        if (queryStr.includes('information_schema.table_constraints')) {
          return Promise.resolve({
            rows: [
              { constraint_name: 'check_store_delivery_radius' },
              { constraint_name: 'check_store_free_delivery_threshold' }
            ]
          });
        }
        if (queryStr.includes('information_schema.columns')) {
          return Promise.resolve({
            rows: [
              { column_name: 'delivery_radius_km', column_default: '3.0' },
              { column_name: 'max_road_distance_km', column_default: '4.5' },
              { column_name: 'road_distance_multiplier', column_default: '1.35' },
              { column_name: 'opening_time', column_default: "'06:00'" },
              { column_name: 'closing_time', column_default: "'23:00'" },
              { column_name: 'delivery_fee', column_default: '29' },
              { column_name: 'free_delivery_threshold', column_default: '499' },
              { column_name: 'minimum_order_value', column_default: '0.00' },
              { column_name: 'free_delivery_enabled', column_default: 'true' },
              { column_name: 'delivery_fee_tiers', column_default: "'[]'::jsonb" }
            ]
          });
        }
        if (queryStr.includes('pg_indexes')) {
          return Promise.resolve({
            rows: [
              { indexname: 'idx_orders_store_id' },
              { indexname: 'idx_admin_store_assignments_user' },
              { indexname: 'idx_admin_store_assignments_store' }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      })
    };

    const res = await verifyTestSchema(mockClient);
    expect(res.totalTables).toBe(9);
    expect(res.foundTables).toContain('stores');
    expect(res.foundTables).toContain('admin_store_assignments');
  });
});
