const { Client } = require('pg');

const url = "postgresql://postgres.raqaqsmmmbjjhnvxjmyy:O6x5zmzc6ekjfuMy@aws-1-ap-south-1.pooler.supabase.com:6543/staging";

const client = new Client({
  connectionString: url,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  await client.connect();
  console.log("Connected to staging DB");
  
  const email = 'viralvitika510@gmail.com';
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Find the user
    const res = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    if (res.rows.length === 0) {
      console.log('User not found!');
      await client.end();
      return;
    }
    
    const userId = res.rows[0].id;
    console.log(`Found user with ID: ${userId}`);
    
    // Delete employee record
    const empRes = await client.query('DELETE FROM employee WHERE "userId" = $1 RETURNING id', [userId]);
    console.log(`Deleted ${empRes.rowCount} employee records.`);
    
    // Delete user record
    const userRes = await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
    console.log(`Deleted ${userRes.rowCount} user records.`);
    
    await client.query('COMMIT');
    console.log('Successfully removed employee details.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
