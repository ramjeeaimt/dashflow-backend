const { Client } = require('pg');
async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:O6x5zmzc6ekjfuMy@db.raqaqsmmmbjjhnvxjmyy.supabase.co:5432/staging'
  });
  await client.connect();
  const res = await client.query("SELECT id, name, \"companyId\" FROM role");
  console.log("Roles in staging:", res.rows);
  await client.end();
}
check().catch(console.error);
