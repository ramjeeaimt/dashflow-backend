import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../../auth.controller';
import { AuthService } from '../../auth.service';
import { CompanyService } from '../../../companies/company.service';
import { UserService } from '../../../users/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../jwt-auth.guard';

jest.mock('bcrypt', () => ({
    compare: jest.fn().mockResolvedValue(true),
}));

describe('Auth Integration Test', () => {
    let app: INestApplication;

    // Mock services from imported modules
    const mockCompanyService = {
        create: jest.fn(),
    };
    const mockUserService = {
        findByEmail: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
    };
    const mockConfigService = {
        get: jest.fn().mockReturnValue('test-secret'),
    };
    const mockJwtService = {
        sign: jest.fn().mockReturnValue('mock-token'),
        verify: jest.fn(),
    };

    beforeAll(async () => {
        try {
            const moduleRef: TestingModule = await Test.createTestingModule({
                controllers: [AuthController],
                providers: [
                    AuthService,
                    { provide: CompanyService, useValue: mockCompanyService },
                    { provide: UserService, useValue: mockUserService },
                    { provide: JwtService, useValue: mockJwtService },
                    { provide: ConfigService, useValue: mockConfigService },
                ],
            })
                // Bypass real JWT guard for simplicity in integration tests
                .overrideGuard(JwtAuthGuard)
                .useValue({ canActivate: () => true })
                .compile();

            app = moduleRef.createNestApplication();
            await app.init();
        } catch (e) {
            console.error('FAILED TO INIT AUTH INTEGRATION TEST:', e);
            throw e;
        }
    });

    it('POST /auth/login should return 200 and access_token on success', async () => {
        const testUser = {
            id: 'user-id',
            email: 'test@mail.com',
            password: 'hashed-password',
            company: { id: 'comp-id' }
        };
        mockUserService.findByEmail.mockResolvedValue(testUser);

        const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: 'test@mail.com', password: 'password' })
            .expect(201);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body.user.id).toEqual('user-id');
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });
});
