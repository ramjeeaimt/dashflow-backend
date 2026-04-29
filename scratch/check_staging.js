const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:O6x5zmzc6ekjfuMy@db.raqaqsmmmbjjhnvxjmyy.supabase.co:5432/staging'
  });
  await client.connect();
  const res = await client.query("SELECT * FROM \"user\"");
  console.log("Users count in staging:", res.rows.length);
  await client.end();
}
check().catch(console.error);
