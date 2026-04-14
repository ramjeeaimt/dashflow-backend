const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const env = process.env.NODE_ENV || 'development';
const connectionString = env === 'production' ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_STAGING;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkClientsSchema() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clients'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in "clients" table:');
    res.rows.forEach(row => console.log(` - ${row.column_name}: ${row.data_type} (${row.is_nullable})`));

    const constraints = await client.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'clients'::regclass;
    `);
    console.log('\nConstraints in "clients" table:');
    constraints.rows.forEach(row => console.log(` - ${row.conname}: ${row.contype}`));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkClientsSchema();
