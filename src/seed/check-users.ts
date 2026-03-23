import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../modules/users/user.service';
import * as bcrypt from 'bcryptjs';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);

  const emails = ['admin@difmo.com', 'john.doe@difmo.com', 'jane.smith@difmo.com'];

  for (const email of emails) {
    const user = await userService.findByEmail(email);
    if (user) {
      const passwordMatch = await bcrypt.compare('Password123!', user.password);
      console.log(`${email}: FOUND | password hash: ${user.password.substring(0, 20)}... | Password123! match: ${passwordMatch}`);
    } else {
      console.log(`${email}: NOT FOUND`);
    }
  }

  await app.close();
}

main();
