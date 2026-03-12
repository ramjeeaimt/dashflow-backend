import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../../app.module';

describe('CompanyModule (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    }, 20000);

    it('/company/id/550e8400-e29b-41d4-a716-446655440000 (GET) - should return 200 (even if null)', async () => {
        return request(app.getHttpServer())
            .get('/company/id/550e8400-e29b-41d4-a716-446655440000')
            .expect(200);
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });
});
