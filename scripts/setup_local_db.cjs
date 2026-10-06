const { Pool } = require('pg');

async function setup() {
  const adminPool = new Pool({ connectionString: 'postgresql://postgres@127.0.0.1:5433/postgres' });
  try {
    await adminPool.query("CREATE ROLE pk_app_user WITH LOGIN PASSWORD 'cWjdpbDil2oPFhQETMUrIlY7zn8Vd4oazYv76Wfcr9i1kjkQ' CREATEDB SUPERUSER;");
    console.log('Role pk_app_user created.');
  } catch (e) {
    console.log('Role pk_app_user notice:', e.message);
  }
  try {
    await adminPool.query("CREATE ROLE pk_migrator WITH LOGIN PASSWORD 'cWjdpbDil2oPFhQETMUrIlY7zn8Vd4oazYv76Wfcr9i1kjkQ' CREATEDB SUPERUSER;");
    console.log('Role pk_migrator created.');
  } catch (e) {
    console.log('Role pk_migrator notice:', e.message);
  }
  try {
    await adminPool.query('CREATE DATABASE pocketkirana_db OWNER pk_app_user;');
    console.log('Database pocketkirana_db created.');
  } catch (e) {
    console.log('Database pocketkirana_db notice:', e.message);
  }
  await adminPool.end();

  const dbPool = new Pool({ connectionString: 'postgresql://postgres@127.0.0.1:5433/pocketkirana_db' });
  try {
    await dbPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('Extension uuid-ossp enabled.');
  } catch (e) {
    console.log('Extension notice:', e.message);
  }
  await dbPool.end();
}

setup().catch(console.error);
