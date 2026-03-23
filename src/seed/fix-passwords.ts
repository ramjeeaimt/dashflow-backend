import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../modules/users/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const configService = app.get(ConfigService);

  const env = configService.get('NODE_ENV') || 'development';
  const dbUrl = configService.get(env === 'production' ? 'DATABASE_URL_PROD' : 'DATABASE_URL') || configService.get('DATABASE_URL');

  console.log('--- Starting Password Fix Script ---');
  console.log(`Target Environment: ${env}`);
  console.log(`Target Database: ${dbUrl ? dbUrl.split('@')[1] : 'Local/Unknown'}`);

  const users = await userRepo.find();
  console.log(`Found ${users.length} total users to check.`);

  for (const user of users) {
    // If password does not start with $2b$ it's not hashed
    if (!user.password.startsWith('$2b$')) {
      console.log(`Fixing password for: ${user.email} (was plain text: ${user.password.substring(0, 10)}...)`);
      const hashed = await bcrypt.hash('Password123!', 10);
      await userRepo.update(user.id, { password: hashed });
      console.log(`  ✅ Fixed: ${user.email}`);
    } else {
      console.log(`  ✔ OK: ${user.email} (already hashed)`);
    }
  }

  console.log('--- Password fix process completed ---');
  await app.close();
}

main();
