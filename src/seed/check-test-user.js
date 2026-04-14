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

async function checkEmployeeUser() {
  try {
    await client.connect();
    
    console.log('Searching for user with email: ramjeekumaryadav558@gmail.com');
    const userRes = await client.query('SELECT * FROM "user" WHERE email = $1', ['ramjeekumaryadav558@gmail.com']);
    
    if (userRes.rows.length === 0) {
      console.log('No user found with that email.');
    } else {
      const user = userRes.rows[0];
      console.log('User found:', { id: user.id, email: user.email, name: user.name });
      
      const empRes = await client.query('SELECT * FROM employee WHERE "userId" = $1', [user.id]);
      if (empRes.rows.length === 0) {
        console.log('No employee record found linked to this user ID.');
      } else {
        const emp = empRes.rows[0];
        console.log('Employee record found:', { id: emp.id, userId: emp.userId, companyId: emp.companyId, branch: emp.branch });
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkEmployeeUser();
