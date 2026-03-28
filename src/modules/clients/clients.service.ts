import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { Invoice } from '../invoices/invoice.entity';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ClientsService {
  private transporter;

  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
  ) {
    // Nodemailer Transporter Configuration
    this.transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

  }

  // Saare clients fetch karne ke liye
  async findAll() {
    return this.clientRepo.find({ 
      relations: ['invoices'],
      order: { createdAt: 'DESC' } // Latest clients upar dikhenge
    });
  }

  // Naya client add karne ke liye (Duplicate Check ke saath)
  async create(clientData: any) {
    const existingClient = await this.clientRepo.findOne({ 
      where: { email: clientData.email } 
    });

    if (existingClient) {
      throw new ConflictException('Bhai, ye email pehle se register hai!');
    }

    const newClient = this.clientRepo.create(clientData);
    return await this.clientRepo.save(newClient);
  }

  // Invoice generate aur Email bhejni ke liye
  async sendInvoice(clientId: string, amount: number) {
    // 1. Client ko check karein
    const client = await this.clientRepo.findOneBy({ id: clientId });
    if (!client) throw new NotFoundException('Client nahi mila, ID check karein');

    // 2. Database mein Invoice save karein
    const invoice = this.invoiceRepo.create({
      invoiceNumber: `INV-${Date.now()}`,
      amount,
      status: 'Pending',
      client,
    });
    const savedInvoice = await this.invoiceRepo.save(invoice);

    // 3. Nodemailer se Email bhejein
    try {
      await this.transporter.sendMail({
        from: '"BharatAI CRM" <your-email@gmail.com>',
        to: client.email,
        subject: `New Invoice Generated: ${invoice.invoiceNumber}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4F46E5;">BharatAI Invoice</h2>
            <p>Hi <b>${client.name}</b>,</p>
            <p>A new invoice has been generated for your recent project.</p>
            <hr/>
            <p><b>Invoice Number:</b> ${invoice.invoiceNumber}</p>
            <p><b>Amount Due:</b> <span style="font-size: 20px; color: #10B981;">$${amount}</span></p>
            <p><b>Status:</b> Pending</p>
            <hr/>
            <p style="font-size: 12px; color: #999;">Ye message BharatAI CRM ke through auto-generated hai.</p>
          </div>
        `,
      });
      console.log(`Email successfully sent to ${client.email}`);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Note: Invoice save ho chuki hai, par email fail hua toh hum response mein bata sakte hain
    }

    return savedInvoice;
  }
}