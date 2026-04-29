const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:O6x5zmzc6ekjfuMy@db.raqaqsmmmbjjhnvxjmyy.supabase.co:5432/postgres',
    connectionTimeoutMillis: 5000 // 5 seconds timeout
  });
  
  try {
    console.log("Connecting...");
    await client.connect();
    console.log("Connected successfully!");
    await client.end();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}
check();
