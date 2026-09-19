/**
 * PocketKirana — Outbox Table Initialization Script
 * Initializes the outbox_events table and indexes in PostgreSQL.
 * Usage: node scripts/init_outbox_table.js
 */

const { Client } = require('pg');

const targetHost = process.env.DB_HOST || '192.168.0.106';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

async function main() {
  console.log('📦 Initializing PostgreSQL Transactional Outbox Table...');
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    const sql = `
      CREATE TABLE IF NOT EXISTS outbox_events (
        id VARCHAR(64) PRIMARY KEY,
        aggregate_type VARCHAR(64) NOT NULL,
        aggregate_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        retry_count INT NOT NULL DEFAULT 0,
        max_retries INT NOT NULL DEFAULT 5,
        lease_token VARCHAR(128),
        leased_until TIMESTAMP WITH TIME ZONE,
        last_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_pending 
      ON outbox_events(status, leased_until) 
      WHERE status IN ('PENDING', 'RETRY_SCHEDULED');

      CREATE INDEX IF NOT EXISTS idx_outbox_aggregate 
      ON outbox_events(aggregate_type, aggregate_id);
    `;

    await client.query(sql);
    console.log('✅ outbox_events table and indexes created successfully!');
  } catch (err) {
    console.error('❌ Failed to initialize outbox table:', err.message);
  } finally {
    await client.end();
  }
}

main();
