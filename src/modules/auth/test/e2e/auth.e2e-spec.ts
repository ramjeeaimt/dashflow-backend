import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../../app.module';

describe('AuthModule (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    }, 20000);

    it('/auth/login (POST) - should return 401 with invalid credentials', () => {
        return request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: 'wrong@mail.com', password: 'wrong' })
            .expect(401);
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });
});
