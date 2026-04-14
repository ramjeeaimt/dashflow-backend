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

async function checkSchema() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'project'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in "project" table:');
    res.rows.forEach(row => console.log(` - ${row.column_name}: ${row.data_type} (${row.is_nullable})`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkSchema();
