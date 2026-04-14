const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const env = process.env.NODE_ENV || 'development';
const connectionString = env === 'production' ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_STAGING;

console.log('Environment:', env);
console.log('Connecting to:', connectionString ? connectionString.replace(/:[^:@]*@/, ':****@') : 'MISSING');

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Tables in DB:');
    res.rows.forEach(row => console.log(' - ' + row.table_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkTables();
