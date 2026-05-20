import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailTemplate } from './email-template.entity';

@Controller('email-templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Post()
  create(@Request() req: any, @Body() createDto: Partial<EmailTemplate>) {
    const companyId = req.user.company?.id || req.user.companyId;
    if (!companyId) {
      throw new ForbiddenException('Company ID is required to create a template');
    }
    return this.emailTemplatesService.create(companyId, createDto);
  }

  @Get()
  findAll(@Request() req: any) {
    const companyId = req.user.company?.id || req.user.companyId;
    if (!companyId) {
      throw new ForbiddenException('Company ID is required to fetch templates');
    }
    return this.emailTemplatesService.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emailTemplatesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: Partial<EmailTemplate>) {
    return this.emailTemplatesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.emailTemplatesService.remove(id);
  }
}
