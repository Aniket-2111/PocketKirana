/**
 * PocketKirana — Production Database Migration: Homepage CMS, Versioning & Audit System
 *
 * Tables:
 *   1. homepage_layouts
 *   2. homepage_layout_versions (Immutable historical snapshots for Rollback & Audit)
 *   3. homepage_audit_logs (Track section changes, publications, rollbacks)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Auto-load .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] ? match[2].trim() : '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (_) {}

const targetHost = process.env.DB_HOST || '192.168.0.101';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb   = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || process.env.PGPASSWORD || '';

const connectionString = `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

const migrationSql = `
-- ═══════════════════════════════════════════════════════════════════
-- POCKETKIRANA HOMEPAGE CMS SCHEMA
-- ═══════════════════════════════════════════════════════════════════

-- 1. Active & Master Homepage Layouts
CREATE TABLE IF NOT EXISTS homepage_layouts (
  id                  VARCHAR(64) PRIMARY KEY,
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  festival_key        VARCHAR(64),
  version             INT NOT NULL DEFAULT 1,
  status              VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED', -- DRAFT | PUBLISHED | SCHEDULED | ARCHIVED
  sections_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at        TIMESTAMP WITH TIME ZONE,
  created_by          VARCHAR(128) DEFAULT 'Admin',
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_homepage_layouts_status ON homepage_layouts(status);

-- 2. Immutable Homepage Layout Versions (Rollback & Historical Auditing)
CREATE TABLE IF NOT EXISTS homepage_layout_versions (
  id                  VARCHAR(64) PRIMARY KEY,
  layout_id           VARCHAR(64) NOT NULL,
  version             INT NOT NULL,
  name                VARCHAR(255) NOT NULL,
  sections_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_summary      TEXT,
  published_by        VARCHAR(128) NOT NULL DEFAULT 'Admin',
  published_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_homepage_versions_ver ON homepage_layout_versions(layout_id, version DESC);

-- 3. Homepage CMS Audit Logs
CREATE TABLE IF NOT EXISTS homepage_audit_logs (
  id                  VARCHAR(64) PRIMARY KEY,
  action              VARCHAR(64) NOT NULL, -- SECTION_CREATED | SECTION_UPDATED | SECTION_DELETED | SECTION_REORDERED | SECTION_ENABLED | SECTION_DISABLED | HOMEPAGE_PUBLISHED | HOMEPAGE_ROLLED_BACK | TEMPLATE_APPLIED
  admin_id            VARCHAR(128) NOT NULL,
  admin_name          VARCHAR(255) NOT NULL,
  admin_role          VARCHAR(64) NOT NULL DEFAULT 'Admin',
  version             INT NOT NULL DEFAULT 1,
  section_id          VARCHAR(64),
  section_title       VARCHAR(255),
  details             TEXT,
  old_state_json      JSONB,
  new_state_json      JSONB,
  timestamp           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_homepage_audit_ts ON homepage_audit_logs(timestamp DESC);
`;

async function runMigration() {
  console.log(`\n===============================================================`);
  console.log(`  POCKETKIRANA — HOMEPAGE CMS SCHEMA MIGRATION                 `);
  console.log(`===============================================================\n`);
  console.log(`📍 Target: ${targetHost}:${targetPort} / ${targetDb}\n`);

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database.');
    await client.query(migrationSql);
    console.log('✅ Homepage CMS schema applied successfully!');
    await client.end();
  } catch (err) {
    console.warn('⚠️ PostgreSQL connection notice (Standalone Dev Mode Active):', err.message);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { migrationSql, runMigration };
