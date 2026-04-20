const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_EnjzltFx6X2Q@ep-still-shape-a8fph0be-pooler.eastus2.azure.neon.tech/difmocrm_prod?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- ADMIN/CEO/CFO EMAILS ---');
  const res = await client.query(`
    SELECT u.email, r.name as role 
    FROM "user" u 
    JOIN user_roles_role ur ON ur."userId" = u.id 
    JOIN role r ON r.id = ur."roleId" 
    WHERE r.name IN ('Admin', 'CEO', 'Founder', 'CFO', 'FOUNDER', 'ADMIN')
  `);
  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
}

main().catch(console.error);
