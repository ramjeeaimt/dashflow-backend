import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/modules/users/user.service';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  
  const email = 'hello@system.com';
  const password = 'hello123';
  
  console.log(`Ensuring Super Admin exists: ${email}`);
  
  let user = await userService.findByEmail(email);

  if (user) {
    console.log('User exists, resetting password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    // @ts-ignore
    await (userService as any).userRepository.update(user.id, { password: hashedPassword });
    // @ts-ignore
    await userService.assignRole(user.id, 'Super Admin');
  } else {
    // @ts-ignore
    const newUser = await userService.create({
      email,
      password,
      firstName: 'System',
      lastName: 'Admin',
      isActive: true,
    } as any);
    console.log('User created successfully.');
    // @ts-ignore
    await userService.assignRole(newUser.id, 'Super Admin');
  }
  
  console.log('Super Admin sync complete.');
  await app.close();
}

bootstrap();
