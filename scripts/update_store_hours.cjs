const { Pool } = require('pg');

async function updateStoreHours() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://pk_app_user:cWjdpbDil2oPFhQETMUrIlY7zn8Vd4oazYv76Wfcr9i1kjkQ@127.0.0.1:5433/pocketkirana_db'
  });

  const stores = ['store_primary', 'store_central_001'];
  for (const sId of stores) {
    const res = await pool.query(
      `UPDATE stores
       SET opening_time = '10:00',
           closing_time = '22:00',
           updated_at = NOW()
       WHERE id = $1 OR UPPER(code) = UPPER($1)
       RETURNING id, code, name, opening_time, closing_time`,
      [sId]
    );

    if (res.rows.length > 0) {
      const updated = res.rows[0];
      console.log(`✅ Store [${updated.id}] (${updated.name}) updated: ${updated.opening_time} -> ${updated.closing_time}`);

      // Insert audit log
      try {
        await pool.query(
          `INSERT INTO audit_logs 
             (id, firebase_uid, action, entity_type, entity_id, old_data, new_data, created_at)
           VALUES (gen_random_uuid()::text, 'admin_system', 'STORE_OPERATIONS_UPDATE', 'STORE', $1, $2::jsonb, $3::jsonb, NOW())`,
          [
            updated.id,
            JSON.stringify({ opening_time: '06:00', closing_time: '23:00' }),
            JSON.stringify({ opening_time: '10:00', closing_time: '22:00' }),
          ]
        );
      } catch (e) {
        console.warn('Audit log write warning:', e.message);
      }
    }
  }

  const check = await pool.query('SELECT id, code, name, opening_time, closing_time FROM stores');
  console.log('\n--- Final Store Hours in Database ---');
  console.table(check.rows);

  await pool.end();
}

updateStoreHours().catch(console.error);
