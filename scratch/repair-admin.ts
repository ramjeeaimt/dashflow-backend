import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/modules/users/user.service';
import { AccessControlService } from '../src/modules/access-control/access-control.service';

async function repairAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  const acService = app.get(AccessControlService);

  const email = 'admin@difmo.com';
  const password = 'password123';
  
  let user = await userService.findByEmail(email) as any;

  if (!user) {
    console.log('Admin user not found. Creating new System Admin...');
    user = await userService.create({
      email,
      password,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    }) as any;
  } else {
    console.log('Admin user found. Resetting password to password123...');
    user.password = password; 
    await userService.saveUser(user);
  }

  // Ensure Super Admin role exists and is assigned
  console.log('Ensuring Super Admin role...');
  let superAdminRole = await userService.findRoleByName('Super Admin');
  if (!superAdminRole) {
    console.log('Creating Super Admin role...');
    superAdminRole = await acService.createRole({
      name: 'Super Admin',
      description: 'Global System Administrator',
    });
  }

  // Assign role to user
  const hasRole = user.roles?.some((r: any) => r.name === 'Super Admin');
  if (!hasRole) {
    console.log('Assigning Super Admin role...');
    if (!user.roles) user.roles = [];
    user.roles.push(superAdminRole);
    await userService.saveUser(user);
  }

  console.log('SUCCESS: System Admin account is ready.');
  console.log('Email: admin@difmo.com');
  console.log('Password: password123');

  await app.close();
}

repairAdmin();
