const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const API_URL = 'http://localhost:3000'; // Assuming backend is running locally

async function triggerPayroll() {
  try {
    // 1. Find the test user ID
    const dbClient = new Client({
      connectionString: process.env.DATABASE_URL_PROD || process.env.DATABASE_URL_STAGING,
      ssl: { rejectUnauthorized: false }
    });
    await dbClient.connect();
    
    const userRes = await dbClient.query('SELECT * FROM "user" WHERE email = $1', ['ramjeekumaryadav558@gmail.com']);
    const user = userRes.rows[0];
    const empRes = await dbClient.query('SELECT * FROM employee WHERE "userId" = $1', [user.id]);
    const emp = empRes.rows[0];
    await dbClient.end();

    console.log(`Found Employee: ${emp.id} for User: ${user.id}`);

    // 2. We don't have a JWT, so let's check if we can call the service directly via a script in the backend
    console.log('To test the service directly, we will use a NestJS script.');

  } catch (err) {
    console.error('Test failed:', err);
  }
}

triggerPayroll();
