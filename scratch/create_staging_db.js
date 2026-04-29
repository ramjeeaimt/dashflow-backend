const { Client } = require('pg');

async function createDb() {
  const client = new Client({
    connectionString: 'postgresql://postgres:O6x5zmzc6ekjfuMy@db.raqaqsmmmbjjhnvxjmyy.supabase.co:5432/postgres'
  });

  try {
    await client.connect();
    console.log("Connected to default postgres database.");
    
    // Check if staging exists
    const res = await client.query("SELECT datname FROM pg_database WHERE datname = 'staging'");
    if (res.rows.length === 0) {
      console.log("Database 'staging' does not exist. Creating...");
      await client.query("CREATE DATABASE staging");
      console.log("Database 'staging' created successfully.");
    } else {
      console.log("Database 'staging' already exists.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

createDb();
