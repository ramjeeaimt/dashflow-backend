import { 
  BadRequestException, Body, Controller, Delete, 
  Get, Param, Patch, Post, Request, UseGuards 
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClientsService } from "./clients.service";

@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  getAllClients() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  getOneClient(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  async createClient(@Body() clientData: any) {
    return await this.clientsService.create(clientData);
  }

  @Patch(':id')
  async updateClient(@Param('id') id: string, @Body() updateData: any) {
    return await this.clientsService.update(id, updateData);
  }

  @Delete(':id')
  async deleteClient(@Param('id') id: string) {
    return await this.clientsService.remove(id);
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
    return this.clientsService.sendInvoice(id, companyId, invoiceData);
  }
}