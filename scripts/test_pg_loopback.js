import { Pool } from 'pg';

async function testConnection(host, port) {
  const connStr = `postgresql://pk_app_user:cWjdpbDil2oPFhQETMUrIlY7zn8Vd4oazYv76Wfcr9i1kjkQ@${host}:${port}/pocketkirana_db`;
  console.log(`Testing ${host}:${port}...`);
  const pool = new Pool({ connectionString: connStr, connectionTimeoutMillis: 3000 });
  try {
    const res = await pool.query('SELECT current_database(), current_user, NOW();');
    console.log(`SUCCESS ${host}:${port} -> DB:`, res.rows[0].current_database, 'User:', res.rows[0].current_user, 'Time:', res.rows[0].now);
    return true;
  } catch (err) {
    console.error(`FAILED ${host}:${port} ->`, err.message);
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  await testConnection('127.0.0.1', 5433);
}

main().catch(console.error);
