
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { CompanyService } from './src/modules/companies/company.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const companyService = app.get(CompanyService);

    // List all companies
    // Note: Since findById expects an ID, I'll need to list all or check by entity.
    // I'll check directly via repository.
    const companyRepo = companyService['companyRepository']; // Hack to get repository
    const companies = await companyRepo.find();
    console.log('--- ALL COMPANIES ---');
    console.log(JSON.stringify(companies, null, 2));

    await app.close();
}

bootstrap();
