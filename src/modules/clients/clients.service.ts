import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException, 
  OnModuleInit, 
  InternalServerErrorException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { Invoice } from '../invoices/invoice.entity';
import * as nodemailer from 'nodemailer';
import * as puppeteer from 'puppeteer';
import { CompaniesGstService } from '../companyGstDocs/companies.Gst.service';
// IMPORT THE SERVICE THAT HOLDS YOUR CompanyDocsGST DATA


@Injectable()
export class ClientsService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    // INJECT THE GST SERVICE
    private readonly gstService: CompaniesGstService,
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'ramjeekumaryadav733@gmail.com',
        pass: 'azslvspnpqhturgw',
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async onModuleInit() {
    try {
      await this.transporter.verify();
      console.log(' DIFMO Billing System: SMTP Verified & Ready');
    } catch (err) {
      console.error(' Billing System SMTP Failure:', err.message);
    }
  }

  // ==========================================
  //         CLIENT MANAGEMENT METHODS
  // ==========================================

  async create(clientData: Partial<Client>): Promise<Client> {
    try {
      // const existing = await this.clientRepo.findOne({ where: { email: clientData.email } });
      // if (existing) {
      //   throw new ConflictException('A client with this email already exists');
      // }
      
      
      // Creating new entity instance with all form fields
      const newClient = this.clientRepo.create({
        ...clientData,
        // Ensure budget is a number if it comes as a string from frontend
        budget: clientData.budget ? Number(clientData.budget) : 0,
        createdAt: new Date()
      });

      return await this.clientRepo.save(newClient);
    } catch (error) {
      console.error('[ClientsService] Create Client Error:', error);
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException(`Error saving client to database: ${error.message}`);
    }
  }

  // FIND ALL: Client list fetch karte waqt invoices bhi load honge
  async findAll(): Promise<Client[]> {
    try {
      return await this.clientRepo.find({
        relations: ['invoices'],
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      throw new InternalServerErrorException('Could not fetch clients');
    }
  }


  

  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['invoices']
    });
    if (!client) throw new NotFoundException(`Client with ID ${id} not found`);
    return client;
  }

  // async create(clientData: Partial<Client>): Promise<Client> {
  //   const existing = await this.clientRepo.findOne({ where: { email: clientData.email } });
  //   if (existing) throw new ConflictException('A client with this email already exists');
    
  //   const newClient = this.clientRepo.create(clientData);
  //   return await this.clientRepo.save(newClient);
  // }

  async update(id: string, updateData: Partial<Client>): Promise<Client> {
    const client = await this.findOne(id);
    const updated = Object.assign(client, updateData);
    return await this.clientRepo.save(updated);
  }

  async remove(id: string): Promise<{ message: string }> {
    const client = await this.findOne(id);
    await this.clientRepo.remove(client);
    return { message: `Client ${client.name} removed successfully` };
  }

  // ==========================================
  //      ULTRA-PREMIUM PDF GENERATOR
  // ==========================================

  private async generateInvoicePdf(
    client: any,
    invoice: any,
    items: any[],
    total: number,
    companyDocs: any, // ADDED: Dynamic data from CompanyDocsGST.jsx
    currencySymbol: string = '₹'
  ): Promise<Buffer> {
    const cgst = total * 0.09;
    const sgst = total * 0.09;
    const grandTotal = total + cgst + sgst;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; }
        
        body { 
          font-family: 'Plus Jakarta Sans', sans-serif; 
          margin: 0; padding: 0; color: #1e293b; background: white; 
        }

        .navbar {
          background: #0f172a !important;
          color: white !important;
          padding: 35px 45px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: center;
          border-bottom: 6px solid #f97316;
        }

        .nav-left { display: flex; align-items: center; gap: 20px; }
        
        .logo-square { 
          width: 55px; height: 55px; background: white; 
          border-radius: 12px; display: flex; align-items: center; justify-content: center; 
        }
        
        .logo-square img { width: 85%; }
        
        .brand-info h1 { font-size: 20px; font-weight: 800; margin: 0; color: white !important; }
        .brand-info p { font-size: 10px; margin: 4px 0 0; opacity: 0.8; color: white !important; }

        .nav-right { text-align: right; font-size: 10px; line-height: 1.6; }
        .nav-right b { color: #f97316; text-transform: uppercase; letter-spacing: 0.5px; }

        .content { padding: 45px; }
        
        .client-strip { 
          display: flex; justify-content: space-between; 
          background: #f8fafc; padding: 25px; border-radius: 18px; 
          border: 1px solid #e2e8f0; margin-bottom: 35px;
        }
        
        .strip-item label { 
          display: block; font-size: 9px; font-weight: 800; 
          color: #64748b; text-transform: uppercase; margin-bottom: 6px; 
        }
        
        .strip-item h3 { margin: 0; font-size: 17px; color: #0f172a; }
        
        .status-tag { 
          background: #fef3c7; color: #92400e; padding: 5px 12px; 
          border-radius: 8px; font-size: 10px; font-weight: 800; 
          margin-top: 8px; display: inline-block;
          border: 1px solid #fde68a;
        }

        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        
        th { 
          background: #f8fafc !important; color: #475569; padding: 15px; 
          font-size: 10px; text-align: left; text-transform: uppercase; 
          border-bottom: 2px solid #e2e8f0; 
        }
        
        td { padding: 20px 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        
        .item-row b { font-size: 15px; color: #0f172a; }
        .phase-text { color: #64748b; font-weight: 600; }

        .bottom-section { 
          display: grid; grid-template-columns: 1.3fr 1fr; 
          gap: 45px; margin-top: 30px; 
        }
        
        .account-box { 
          background: #f8fafc; padding: 25px; border-radius: 15px; 
          border: 1px solid #e2e8f0; font-size: 12px; line-height: 1.8; 
        }
        
        .account-box h4 { 
          color: #f97316; margin: 0 0 15px 0; font-size: 12px; 
          text-transform: uppercase; border-bottom: 1px solid #e2e8f0; 
          padding-bottom: 8px;
        }

        .calculation-box { background: #f8fafc; padding: 25px; border-radius: 15px; }
        
        .calc-row { 
          display: flex; justify-content: space-between; 
          padding: 10px 0; font-size: 14px; color: #475569;
        }
        
        .grand-total-row { 
          background: #f97316 !important; color: white !important; 
          padding: 18px; border-radius: 10px; font-weight: 800; font-size: 20px; 
          display: flex; justify-content: space-between; margin-top: 15px;
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);
        }

        .footer-legal { 
          text-align: center; font-size: 10px; color: #94a3b8; 
          margin-top: 60px; padding-top: 25px; border-top: 1px solid #f1f5f9; 
        }
        
        .terms-footer { 
          font-size: 10px; color: #64748b; text-align: left; 
          margin-bottom: 15px; line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="navbar">
        <div class="nav-left">
          <div class="logo-square">
            <img src="https://image2url.com/r2/default/images/1774814179038-4873fd12-c9d3-4de0-a40f-f8ced1eb12d2.jpg">
          </div>
          <div class="brand-info">
            <h1>${companyDocs?.companyName || 'DIFMO PRIVATE LIMITED'}</h1>
            <p>GST: ${companyDocs?.gstNumber || 'N/A'} | +91 9519202509</p>
          </div>
        </div>
        <div class="nav-right">
          <b>Official Address</b><br>
          KV House E-4/37, Vibhav Khand, Gomtinagar,<br>
          Lucknow, UP - 226010<br>
          Email: billing@difmo.com | Support: +91 9519202509
        </div>
      </div>

      <div class="content">
        <div class="client-strip">
          <div class="strip-item">
            <label>Recipient Information</label>
            <h3>${client.name}</h3>
            <span>${client.email}</span>
          </div>
          <div class="strip-item" style="text-align: right;">
            <label>Invoice Identifier</label>
            <h3>#${invoice.invoiceNumber}</h3>
            <span>Dated: ${new Date().toLocaleDateString('en-IN')}</span><br>
            <span class="status-tag">Status: PENDING</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35%;">Service Specification</th>
              <th style="width: 20%;">Project Phase</th>
              <th style="width: 10%;">Quantity</th>
              <th style="width: 15%;">Unit Rate</th>
              <th style="width: 20%; text-align: right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td class="item-row"><b>${item.service}</b></td>
                <td class="phase-text">${item.phase || 'General'}</td>
                <td>${item.quantity}</td>
                <td>${currencySymbol}${item.price.toLocaleString()}</td>
                <td style="text-align: right; font-weight: 700;">${currencySymbol}${(item.quantity * item.price).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="bottom-section">
          <div class="account-box">
            <h4>Settlement Account Details</h4>
            <b>Bank Name:</b> ${companyDocs?.bankName || 'N/A'}<br>
            <b>Account Name:</b> ${companyDocs?.accountName || 'N/A'}<br>
            <b>Account No:</b> ${companyDocs?.accountNumber || 'N/A'}<br>
            <b>IFSC Code:</b> ${companyDocs?.ifscCode || 'N/A'}<br>
            <b>PAN Number:</b> ${companyDocs?.panNumber || 'N/A'}
          </div>
          
          <div class="calculation-box">
            <div class="calc-row"><span>Sub-Total</span> <span>${currencySymbol}${total.toLocaleString()}</span></div>
            <div class="calc-row" style="border-bottom: 1px solid #e2e8f0; margin-bottom: 10px;">
              <span>Taxes (18% GST)</span> 
              <span>${currencySymbol}${(cgst + sgst).toLocaleString()}</span>
            </div>
            <div class="grand-total-row">
              <span>Grand Total</span> 
              <span>${currencySymbol}${grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div class="footer-legal">
          <div class="terms-footer">
            <b>Terms & Conditions:</b><br>
            1. Payment is due within 7 business days from the date of issue.<br>
            2. 18% GST (CGST 9% + SGST 9%) is applicable as per government norms.<br>
            3. This is a computer-generated document and requires no physical signature.
          </div>
          CIN: U72900UP2023PTC184512 | Registered Office: Lucknow, UP-226010
        </div>
      </div>
    </body>
    </html>
    `;

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
    });
    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  // ==========================================
  //      CORE ACTION: DISPATCH INVOICE
  // ==========================================
  async sendInvoice(clientId: string, companyId: string, invoiceData: any) {
    console.log(`[ClientsService] Initiate sendInvoice for client: ${clientId}, company: ${companyId}`);
    const client = await this.clientRepo.findOneBy({ id: clientId });
    if (!client) {
      console.error(`[ClientsService] Client NOT FOUND: ${clientId}`);
      throw new NotFoundException('Client reference missing');
    }
    console.log(`[ClientsService] Resolved Client Email: ${client.email}`);

    // FETCH THE DYNAMIC DETAILS FROM DATABASE
    const companyDocs = await this.gstService.findOne(companyId);

    const items = invoiceData.items || [];
    const baseAmount = parseFloat(invoiceData.total || 0);
    const currencySymbol = invoiceData.currencySymbol || '₹';
    const totalTax = baseAmount * 0.18;
    const finalAmount = baseAmount + totalTax;

    const invoice = this.invoiceRepo.create({
      invoiceNumber: `DIF-INV-${Date.now().toString().slice(-6)}`,
      amount: baseAmount,
      status: 'Pending',
      client,
    });
    const savedInvoice = await this.invoiceRepo.save(invoice);

    try {
      console.log(`[ClientsService] Generating PDF for Invoice #${savedInvoice.invoiceNumber}`);
      const pdfBuffer = await this.generateInvoicePdf(
        client, 
        savedInvoice, 
        items, 
        baseAmount, 
        companyDocs, 
        currencySymbol
      );
      console.log(`[ClientsService] PDF Generated, size: ${pdfBuffer.length} bytes`);

      console.log(`[ClientsService] Dispatching email to: ${client.email} from: ramjeekumaryadav733@gmail.com`);
      
      const info = await this.transporter.sendMail({
        from: '"DIFMO Billing Team" <ramjeekumaryadav733@gmail.com>',
        to: client.email,
        subject: `ACTION REQUIRED: Invoice #${savedInvoice.invoiceNumber} for ${client.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background: white;">
            <div style="background: #0f172a; padding: 40px; text-align: center; border-bottom: 4px solid #f97316;">
              <h2 style="color: white; margin: 0; text-transform: uppercase; letter-spacing: 2px;">Payment Request</h2>
            </div>
            <div style="padding: 40px; color: #1f2937;">
              <p style="font-size: 16px;">Hello <b>${client.name}</b>,</p>
              <p>The billing department of <b>${companyDocs?.companyName || 'DIFMO Private Limited'}</b> has issued a new invoice for your ongoing project services.</p>
              
              <div style="background: #f9fafb; border-radius: 12px; padding: 25px; margin: 30px 0; border: 1px solid #e5e7eb;">
                <table style="width: 100%;">
                  <tr>
                    <td style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Invoice Reference</td>
                    <td style="text-align: right; font-weight: bold;">#${savedInvoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 12px; text-transform: uppercase; padding-top: 10px;">Total Due Amount</td>
                    <td style="text-align: right; color: #f97316; font-size: 20px; font-weight: 800; padding-top: 10px;">${currencySymbol}${finalAmount.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #fff9f5; border: 1px solid #ffedd5; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
                <h4 style="margin: 0 0 10px 0; color: #f97316; font-size: 14px; text-transform: uppercase;">Payment Settlement Details</h4>
                <p style="margin: 4px 0; font-size: 13px;"><b>Bank:</b> ${companyDocs?.bankName}</p>
                <p style="margin: 4px 0; font-size: 13px;"><b>Account Name:</b> ${companyDocs?.accountName}</p>
                <p style="margin: 4px 0; font-size: 13px;"><b>Account No:</b> ${companyDocs?.accountNumber}</p>
                <p style="margin: 4px 0; font-size: 13px;"><b>IFSC Code:</b> ${companyDocs?.ifscCode}</p>
              </div>

              <p>We have attached the detailed PDF invoice containing the service breakdown and secure payment instructions.</p>
              <p><b>Note:</b> For any billing queries, please contact us at <a href="mailto:billing@difmo.com">billing@difmo.com</a>.</p>
              
              <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
                Best Regards,<br>
                <b>Finance & Billing Team</b><br>
                ${companyDocs?.companyName || 'DIFMO Private Limited'} | Lucknow, UP
              </div>
            </div>
          </div>
        `,
        attachments: [{
          filename: `DIFMO_Invoice_${savedInvoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
        }],
      });

      console.log(`[ClientsService] Email Success! MessageId: ${info.messageId}`);
      console.log(`[ClientsService] Full SMTP Response: ${JSON.stringify(info)}`);

      return savedInvoice;
    } catch (e) {
      console.error("[ClientsService] CRITICAL MAILER ERROR:", e);
      console.error("[ClientsService] Error Message:", e.message);
      if (e.response) console.error("[ClientsService] SMTP Response:", e.response);
      throw new BadRequestException(`Invoice generated but email dispatch failed: ${e.message}`);
    }
  }
}