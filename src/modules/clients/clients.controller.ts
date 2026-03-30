import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  getAllClients() {
    return this.clientsService.findAll();
  }

  @Post() // Ye naye client ke liye hai
  createClient(@Body() clientData: any) {
    return this.clientsService.create(clientData);
  }

  @Post(':id/send-invoice')
  async sendInvoice(
    @Param('id') id: string,
    @Body() invoiceData: any, // Frontend se pura object aa raha hai
  ) {
    return this.clientsService.sendInvoice(id, invoiceData);
  }
}