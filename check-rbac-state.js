const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_EnjzltFx6X2Q@ep-still-shape-a8fph0be-pooler.eastus2.azure.neon.tech/difmocrm_prod?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- ROLES ---');
  const roles = await client.query('SELECT id, name FROM role');
  console.log(JSON.stringify(roles.rows, null, 2));

  console.log('\n--- PERMISSIONS FOR SPECIFIC ROLES ---');
  const perms = await client.query(`
    SELECT r.name as role, p.action, p.resource 
    FROM role r 
    JOIN role_permissions_permission rp ON rp."roleId" = r.id 
    JOIN permission p ON p.id = rp."permissionId" 
    WHERE r.name IN ('MANAGER', 'CEO', 'CTO', 'CFO', 'Founder', 'Admin')
    ORDER BY r.name
  `);
  console.log(JSON.stringify(perms.rows, null, 2));

  console.log('\n--- TARGET USER ROLES ---');
  const user = await client.query(`
    SELECT u.email, r.name as role
    FROM "user" u
    LEFT JOIN user_roles_role ur ON ur."userId" = u.id
    LEFT JOIN role r ON r.id = ur."roleId"
    WHERE u.email = 'ramjeekumaryadav558@gmail.com'
  `);
  console.log(JSON.stringify(user.rows, null, 2));

  await client.end();
}

main().catch(console.error);
