import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CompanyModule } from '../../company.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from '../../company.entity';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';

describe('Company Integration Test', () => {
    let app: INestApplication;

    // Mock Repository for the DB layer
    const mockCompanyRepository = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        find: jest.fn(),
    };

    beforeAll(async () => {
        const moduleRef: TestingModule = await Test.createTestingModule({
            imports: [CompanyModule],
        })
            .overrideProvider(getRepositoryToken(Company))
            .useValue(mockCompanyRepository)
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    it('GET /company/id/:id should return company data', async () => {
        const testCompany = { id: 'test-id', name: 'Test Co' };
        mockCompanyRepository.findOne.mockResolvedValue(testCompany);

        const response = await request(app.getHttpServer())
            .get('/company/id/test-id')
            .expect(200);

        expect(response.body).toEqual(testCompany);
        expect(mockCompanyRepository.findOne).toHaveBeenCalledWith({
            where: { id: 'test-id' },
            relations: ['users', 'departments'],
        });
    });

    it('POST /company should create a new company', async () => {
        const createDto = {
            name: 'New Co',
            email: 'new@co.com'
        };
        const savedCompany = { id: 'new-id', ...createDto };

        mockCompanyRepository.create.mockReturnValue(savedCompany);
        mockCompanyRepository.save.mockResolvedValue(savedCompany);

        const response = await request(app.getHttpServer())
            .post('/company')
            .send(createDto)
            .expect(201);

        expect(response.body).toEqual(savedCompany);
        expect(mockCompanyRepository.create).toHaveBeenCalledWith(createDto);
        expect(mockCompanyRepository.save).toHaveBeenCalled();
    });

    afterAll(async () => {
        await app.close();
    });
});
