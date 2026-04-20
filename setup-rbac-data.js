const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_EnjzltFx6X2Q@ep-still-shape-a8fph0be-pooler.eastus2.azure.neon.tech/difmocrm_prod?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- DB SETUP: ROLES & PERMISSIONS ---');

  // 1. Ensure CFO role exists
  let cfoRes = await client.query("SELECT id FROM role WHERE name = 'CFO'");
  let cfoId;
  if (cfoRes.rows.length === 0) {
    const insert = await client.query("INSERT INTO role (id, name, description) VALUES (gen_random_uuid(), 'CFO', 'Chief Financial Officer') RETURNING id");
    cfoId = insert.rows[0].id;
    console.log('  ✓ Created CFO role');
  } else {
    cfoId = cfoRes.rows[0].id;
    console.log('  . CFO role already exists');
  }

  // 2. Identify MANAGER and CEO role IDs
  const managerRes = await client.query("SELECT id FROM role WHERE name = 'MANAGER'");
  const managerId = managerRes.rows[0]?.id;
  
  const ceoRes = await client.query("SELECT id FROM role WHERE name = 'CEO'");
  const ceoId = ceoRes.rows[0]?.id;

  const permissions = [
    // CFO permissions
    { roleId: cfoId, action: 'read', resource: 'payroll' },
    { roleId: cfoId, action: 'create', resource: 'payroll' },
    { roleId: cfoId, action: 'update', resource: 'payroll' },
    { roleId: cfoId, action: 'manage', resource: 'payroll' },
    { roleId: cfoId, action: 'read', resource: 'expense' },
    { roleId: cfoId, action: 'create', resource: 'expense' },
    { roleId: cfoId, action: 'manage', resource: 'expense' },
    { roleId: cfoId, action: 'read', resource: 'dashboard' },
    
    // MANAGER permissions
    { roleId: managerId, action: 'read', resource: 'employee' },
    { roleId: managerId, action: 'manage', resource: 'attendance' },
    { roleId: managerId, action: 'manage', resource: 'leave' },
    { roleId: managerId, action: 'read', resource: 'task' },
    { roleId: managerId, action: 'read', resource: 'dashboard' }
  ];

  if (ceoId) {
    permissions.push({ roleId: ceoId, action: 'manage', resource: 'all' });
  }

  for (const perm of permissions) {
    if (!perm.roleId) continue;

    // Find or create permission
    let pRes = await client.query('SELECT id FROM permission WHERE action = $1 AND resource = $2', [perm.action, perm.resource]);
    let pId;
    if (pRes.rows.length === 0) {
      console.log(`  + Creating permission: ${perm.action}:${perm.resource}`);
      const pInsert = await client.query('INSERT INTO permission (id, action, resource) VALUES (gen_random_uuid(), $1, $2) RETURNING id', [perm.action, perm.resource]);
      pId = pInsert.rows[0].id;
    } else {
      pId = pRes.rows[0].id;
    }

    // Link to role
    const linkRes = await client.query('SELECT * FROM role_permissions_permission WHERE "roleId" = $1 AND "permissionId" = $2', [perm.roleId, pId]);
    if (linkRes.rows.length === 0) {
       await client.query('INSERT INTO role_permissions_permission ("roleId", "permissionId") VALUES ($1, $2)', [perm.roleId, pId]);
       console.log(`  ✓ Linked ${perm.action}:${perm.resource} to role ID ${perm.roleId}`);
    }
  }

  console.log('\n--- SUCCESS ---');
  await client.end();
}

main().catch(console.error);
