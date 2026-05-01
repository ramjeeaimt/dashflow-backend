import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CompanyService } from '../src/modules/companies/company.service';
import { UserService } from '../src/modules/users/user.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const companyService = app.get(CompanyService);
  const userService = app.get(UserService);

  const email = 'pritam@difmo.com';
  const user = await userService.findByEmail(email);

  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  // IDs of companies to link
  const companyIds = [
    'c51b6891-7045-43f1-8a13-fc392e51c859', // Original: Difmo
    'e528aa31-25a0-42cb-9d04-3a4ecbdf93ca'  // New: Difmo Solutions
  ];

  user.companies = companyIds.map(id => ({ id } as any));
  
  await userService.saveUser(user);
  console.log('Successfully linked multiple companies to:', email);

  await app.close();
}

bootstrap();
