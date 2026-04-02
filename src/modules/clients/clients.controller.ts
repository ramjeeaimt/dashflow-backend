import { BadRequestException, Body, Controller, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClientsService } from "./clients.service";

@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  getAllClients() {
    return this.clientsService.findAll();
  }

  @Post()
  async createClient(@Body() clientData: any) {
    // clientData mein ab name, email, phone, city, budget sab aayega
    return await this.clientsService.create(clientData);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/send-invoice')
  async sendInvoice(
    @Param('id') id: string,
    @Body() invoiceData: any, 
    @Request() req: any 
  ) {
    const companyId = req.user?.companyId || req.user?.company?.id;
    if (!companyId) {
      throw new BadRequestException('Company context not found');
    }
    return this.clientsService.sendInvoice(id, invoiceData, companyId);
  }
}