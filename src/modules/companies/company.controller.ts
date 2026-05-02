import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('system-company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) { }

  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companyService.create(createCompanyDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req: any) {
    const user = req.user;
    const isSuperAdmin = user?.roles?.some(r => r.name === 'Super Admin') || 
                         ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user?.email?.toLowerCase());
    
    if (!isSuperAdmin) {
      throw new ForbiddenException('Super Admin access required');
    }
    
    return this.companyService.findAll(true);
  }

  @Get('id/:id')
  findById(@Param('id') id: string) {
    console.log('Fetching company by ID:', id);
    return this.companyService.findById(id);
  }

  @Get(':email')
  findOne(@Param('email') email: string) {
    return this.companyService.findByEmail(email);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateCompanyDto: any) {
    return this.companyService.update(id, updateCompanyDto);
  }

  @Patch(':id/block')
  @UseGuards(JwtAuthGuard)
  async block(@Param('id') id: string, @Request() req: any) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    if (!isSuperAdmin) throw new Error('Forbidden');
    return this.companyService.block(id);
  }

  @Patch(':id/unblock')
  @UseGuards(JwtAuthGuard)
  async unblock(@Param('id') id: string, @Request() req: any) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    if (!isSuperAdmin) throw new Error('Forbidden');
    return this.companyService.unblock(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Request() req: any) {
    const user = req.user;
    const isSuperAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email);
    if (!isSuperAdmin) throw new Error('Forbidden');
    return this.companyService.softDelete(id);
  }
}
