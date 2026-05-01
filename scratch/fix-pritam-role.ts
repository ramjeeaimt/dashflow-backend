import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/modules/users/user.service';
import { AccessControlService } from '../src/modules/access-control/access-control.service';

async function audit() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  const acService = app.get(AccessControlService);

  const email = 'pritam@difmo.com';
  const user = await userService.findByEmail(email);

  if (!user) {
    console.log('User not found');
    await app.close();
    return;
  }

  console.log(`User: ${user.firstName} ${user.lastName} (${user.email})`);
  console.log(`Current Roles:`, user.roles?.map(r => r.name) || 'NONE');
  console.log(`Company:`, user.company?.name || 'NONE');

  // If no Admin role, let's find the Admin role for his company and assign it
  if (!user.roles?.some(r => r.name === 'Admin')) {
    console.log('Fixing: Assigning Admin role...');
    const allRoles = await acService.findAllRoles(user.company?.id);
    const adminRole = allRoles.find(r => r.name === 'Admin');

    if (adminRole) {
      user.roles = [...(user.roles || []), adminRole];
      await userService.saveUser(user);
      console.log('Success: Admin role assigned!');
    } else {
      console.log('Error: Admin role not found for this company.');
    }
  }

  await app.close();
}

audit();
