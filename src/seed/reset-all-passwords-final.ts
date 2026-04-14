import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../modules/users/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

async function main() {
  console.log('--- STARTING BULK PASSWORD RESET ---');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

  try {
    const users = await userRepo.find();
    console.log(`Found ${users.length} total users to reset.`);

    for (const user of users) {
      const email = user.email.toLowerCase();
      const isTargetAdmin = email === 'admin@difmo.com';
      
      let newPasswordRaw = 'welcome123';
      let label = '[EMPLOYEE]';

      if (isTargetAdmin) {
        newPasswordRaw = 'password123';
        label = '[ADMIN]';
      }

      console.log(`${label} Resetting password for: ${email}`);
      
      const hashedPassword = await bcrypt.hash(newPasswordRaw, 10);
      
      // We use update() to bypass hooks since we are hashing manually here for speed/control
      // and to ensure clean overwriting of any previous bad hashes.
      await userRepo.update(user.id, { password: hashedPassword });
    }

    console.log('\n--- SUCCESS ---');
    console.log('All passwords have been reset and hashed.');
    console.log('Admin (admin@difmo.com): password123');
    console.log('All Employees: welcome123');

  } catch (error) {
    console.error('CRITICAL ERROR:', error);
  } finally {
    await app.close();
  }
}

main();
