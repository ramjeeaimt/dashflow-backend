const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_EnjzltFx6X2Q@ep-still-shape-a8fph0be-pooler.eastus2.azure.neon.tech/difmocrm_prod?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- GRANTING PERMISSIONS TO MANAGER ROLE ---');

  // 1. Find the Manager Role
  const roleRes = await client.query("SELECT id FROM role WHERE name = 'Manager'");
  if (roleRes.rows.length === 0) {
    console.error('Manager role not found');
    await client.end();
    return;
  }
  const roleId = roleRes.rows[0].id;

  // 2. Define permissions to grant
  const permissionsToGrant = [
    { action: 'read', resource: 'employee' },
    { action: 'read', resource: 'attendance' },
    { action: 'read', resource: 'leave' },
    { action: 'read', resource: 'payroll' },
    { action: 'read', resource: 'project' },
    { action: 'read', resource: 'task' },
    { action: 'read', resource: 'client' },
    { action: 'manage', resource: 'attendance' }, // Managers manage attendance
    { action: 'manage', resource: 'leave' }      // Managers manage leaves
  ];

  for (const perm of permissionsToGrant) {
    // A. Find or create permission
    let permRes = await client.query('SELECT id FROM permission WHERE action = $1 AND resource = $2', [perm.action, perm.resource]);
    let permissionId;
    
    if (permRes.rows.length === 0) {
      console.log(`  + Creating permission: ${perm.action}:${perm.resource}`);
      const insertRes = await client.query('INSERT INTO permission (id, action, resource) VALUES (gen_random_uuid(), $1, $2) RETURNING id', [perm.action, perm.resource]);
      permissionId = insertRes.rows[0].id;
    } else {
      permissionId = permRes.rows[0].id;
    }

    // B. Link permission to role (if not already linked)
    const linkRes = await client.query('SELECT * FROM role_permissions_permission WHERE "roleId" = $1 AND "permissionId" = $2', [roleId, permissionId]);
    if (linkRes.rows.length === 0) {
      console.log(`  + Linking ${perm.action}:${perm.resource} to Manager role`);
      await client.query('INSERT INTO role_permissions_permission ("roleId", "permissionId") VALUES ($1, $2)', [roleId, permissionId]);
    } else {
      console.log(`  . Already linked: ${perm.action}:${perm.resource}`);
    }
  }

  console.log('\n--- SUCCESS ---');
  await client.end();
}

main().catch(console.error);
