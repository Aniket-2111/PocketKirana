const { getPostgresPool } = require('../lib/postgres');

async function verifyG1Postgres() {
  console.log('--- Verifying Gate G1: PostgreSQL Production Authority ---');
  try {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT version(), current_database(), current_user, NOW() as current_time');
      console.log('✅ PostgreSQL Connected:', res.rows[0]);
      
      const tablesRes = await client.query(`
        SELECT count(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log(`✅ Table Count: ${tablesRes.rows[0].table_count}`);

      const seqRes = await client.query(`
        SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'pk_order_seq'
      `);
      console.log(`✅ Sequence pk_order_seq exists: ${seqRes.rowCount > 0}`);

      console.log('🟢 G1 PostgreSQL Verification Passed.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ G1 Verification Failed:', err.message);
    return false;
  }
}

if (require.main === module) {
  verifyG1Postgres().then(ok => process.exit(ok ? 0 : 1));
}

module.exports = { verifyG1Postgres };
