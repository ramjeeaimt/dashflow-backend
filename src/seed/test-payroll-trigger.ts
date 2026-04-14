import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FinanceService } from '../modules/finance/finance.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const financeService = app.get(FinanceService);

    console.log('--- STARTING PAYROLL NOTIFICATION TEST ---');
    
    // Test data for ramjeekumaryadav558@gmail.com
    const testData = {
        employeeId: 'bee8492e-a9f6-402e-83e9-85baed00e8b0',
        companyId: '89b3cc37-72dd-47ea-a619-282b6cc7dd3c',
        basicSalary: 50000,
        netSalary: 45000,
        month: 4,
        year: 2026,
        status: 'pending'
    };

    try {
        console.log('Triggering createPayroll for employee bee8492e...');
        const result: any = await financeService.createPayroll(testData as any);
        console.log('Payroll record created successfully. ID:', result.id);
        console.log('--- TEST FINISHED. CHECK CONSOLE LOGS FOR NOTIFICATION ACTIVITY ---');
    } catch (error) {
        console.error('FAILED to create payroll:', error);
    } finally {
        await app.close();
    }
}

bootstrap().catch(err => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
});
