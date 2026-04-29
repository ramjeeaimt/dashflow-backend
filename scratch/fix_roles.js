const { Client } = require('pg');
async function fix() {
  const client = new Client({
    connectionString: 'postgresql://postgres:O6x5zmzc6ekjfuMy@db.raqaqsmmmbjjhnvxjmyy.supabase.co:5432/staging'
  });
  await client.connect();
  const companyRes = await client.query("SELECT id FROM company WHERE email = 'hello@difmo.com'");
  if (companyRes.rows.length > 0) {
    const companyId = companyRes.rows[0].id;
    await client.query("UPDATE role SET \"companyId\" = $1 WHERE \"companyId\" IS NULL", [companyId]);
    console.log(`Updated roles with companyId: ${companyId}`);
  }
  await client.end();
}
fix().catch(console.error);
