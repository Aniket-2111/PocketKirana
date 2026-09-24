const { Client } = require('pg');

const targetHost = process.env.DB_HOST || '192.168.0.106';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

async function run() {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();

  console.log('--- PRODUCTS COLUMNS ---');
  const prodCols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    ORDER BY ordinal_position;
  `);
  console.table(prodCols.rows);

  console.log('--- PRODUCT_VARIANTS COLUMNS ---');
  const varCols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'product_variants' 
    ORDER BY ordinal_position;
  `);
  console.table(varCols.rows);

  console.log('--- EXISTING INDEXES ON PRODUCTS & VARIANTS ---');
  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('products', 'product_variants')
    ORDER BY tablename, indexname;
  `);
  console.table(indexes.rows);

  await client.end();
}

run().catch(console.error);
