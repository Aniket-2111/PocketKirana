const { Pool } = require('pg');

async function verifyPK16() {
  const pool = new Pool({ connectionString: 'postgresql://pk_app_user:cWjdpbDil2oPFhQETMUrIlY7zn8Vd4oazYv76Wfcr9i1kjkQ@127.0.0.1:5433/pocketkirana_db' });
  
  const o = await pool.query("SELECT id, order_number, order_status, payment_status, total_amount, delivery_fee, delivery_otp FROM orders WHERE order_number = 'PK-16'");
  console.log('--- Orders Table ---');
  console.table(o.rows);

  const p = await pool.query("SELECT id, order_id, payment_method, amount, status, gateway FROM payments WHERE order_id = $1", [o.rows[0].id]);
  console.log('--- Payments Table ---');
  console.table(p.rows);

  const h = await pool.query("SELECT old_status, new_status, changed_by, notes FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC", [o.rows[0].id]);
  console.log('--- Order Status History Timeline ---');
  console.table(h.rows);

  await pool.end();
}

verifyPK16().catch(console.error);
