import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from '../../company.controller';
import { CompanyService } from '../../company.service';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';

describe('CompanyController', () => {
  let controller: CompanyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        {
          provide: CompanyService,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CompanyController>(CompanyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
