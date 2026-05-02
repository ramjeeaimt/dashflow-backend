import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Payroll } from './entities/payroll.entity';
import { Expense } from './entities/expense.entity';
import { Company } from '../companies/company.entity';
import { Employee } from '../employees/employee.entity';
import { Attendance } from '../attendance/attendance.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
const PDFDocument = require('pdfkit');

import { Settings } from 'http2';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Payroll)
    private readonly payrollRepository: Repository<Payroll>,

    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,

    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,

    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,

    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,

    private readonly notificationsService: NotificationsService,


  ) { }

  // Exchange rates relative to 1 USD
  private readonly rates = {
    USD: 1,
    INR: 83.5,
    GBP: 0.78,
    EUR: 0.92,
    AED: 3.67
  };

  /**
   * Converts an amount from source currency to target currency
   */
  private convert(amount: number, from: string = 'USD', to: string = 'USD'): number {
    const fromRate = this.rates[from.toUpperCase()] || 1;
    const toRate = this.rates[to.toUpperCase()] || 1;
    // Convert to USD first, then to target
    const inUsd = amount / fromRate;
    return inUsd * toRate;
  }

  /**
   * Cleans a currency string and converts to number
   */
  private parseSalary(salary: string | number): number {
    if (typeof salary === 'number') return salary;
    if (!salary) return 0;
    // Remove ₹, commas, and other non-numeric chars except decimal point
    const cleaned = String(salary).replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  // Payroll
  async createPayroll(data: Partial<Payroll>): Promise<Payroll> {
    const payroll = await this.payrollRepository.save(this.payrollRepository.create(data));

    // 🔥 Real-time Notification to Employee on Creation
    try {
      const emp = await this.employeeRepository.findOne({
        where: { id: payroll.employeeId },
        relations: ['user']
      });
      if (emp && emp.userId) {
        const netSal = this.parseSalary(payroll.netSalary);
        console.log(`[FinanceService] Notifying employee ${emp.id} of payroll creation. Net Salary: ${netSal}`);
        await this.notificationsService.send({
          title: 'Difmo Pvt Ltd: Payroll Slip Generated',
          message: `Your payroll for ${payroll.month}/${payroll.year} has been generated. Net Salary: ₹${netSal.toFixed(2)}.`,
          type: 'both',
          recipientFilter: 'employees',
          recipientIds: [emp.userId],
          companyId: payroll.companyId,
          metadata: {
            type: 'PAYROLL_GENERATED',
            month: payroll.month,
            year: payroll.year,
            netSalary: netSal,
            basicSalary: payroll.basicSalary,
            deductions: payroll.deductions,
            allowances: payroll.allowances,
            employeeName: emp.user ? `${emp.user.firstName} ${emp.user.lastName}` : 'Employee'
          }
        });
      }
    } catch (err) {
      console.error(`[FinanceService] Failed to notify employee on payroll creation:`, err.message);
    }

    return payroll;
  }
  //   async generatePayroll(data: Partial<Payroll>): Promise<Payroll> {
  //   return this.payrollRepository.save(this.payrollRepository.create(data));
  // }

  // finance.service.ts
  async findAllPayroll(
    employeeId?: string,
    month?: number,
    year?: number,
    companyId?: string,
  ): Promise<Payroll[]> {

    const query = this.payrollRepository.createQueryBuilder('payroll')
      .leftJoinAndSelect('payroll.employee', 'employee')
      .leftJoinAndSelect('employee.user', 'user');

    if (companyId && companyId !== 'undefined') {
      query.andWhere(new Brackets(qb => {
        qb.where('payroll.companyId = :companyId', { companyId })
          .orWhere('employee.companyId = :companyId', { companyId });
      }));
    }

    // 3. Employee Case: Filter by Employee (User ID or Profile ID)
    if (employeeId && employeeId !== 'undefined') {
      // Check if the ID is a UserID or EmployeeID
      const employee = await this.employeeRepository.findOne({
        where: [{ id: employeeId }, { userId: employeeId }]
      });

      const finalId = employee ? employee.id : employeeId;
      query.andWhere('payroll.employeeId = :employeeId', { employeeId: finalId });
    }

    // 4. Month & Year Filters
    if (month) {
      query.andWhere('payroll.month = :month', { month: Number(month) });
    }
    if (year) {
      query.andWhere('payroll.year = :year', { year: Number(year) });
    }

    // 5. IMPORTANT: Duplicate records hatao
    // TypeORM ka getMany() QueryBuilder ke saath internally handles mapping, 
    // but hum explicitly order handle karenge
    query.orderBy('payroll.year', 'DESC')
      .addOrderBy('payroll.month', 'DESC')
      .addOrderBy('payroll.id', 'ASC'); // ID par order dene se duplicates identify karna easy hota hai

    const results = await query.getMany();

    // 6. Final Safety Net: Agar abhi bhi DB level se duplicates aa rahe hain (Unique IDs filter)
    const uniquePayrolls = Array.from(new Map(results.map(item => [item.id, item])).values());

    return uniquePayrolls;
  }

  async findEmployeeByUserId(userId: string) {
    return this.employeeRepository.findOne({
      where: { userId: userId }
    });
  }

  // Expenses
  async createExpense(data: Partial<Expense>, userId: string): Promise<Expense> {
    if (!data.companyId) {
      throw new Error('companyId is required');
    }

    if (!data.amount || isNaN(Number(data.amount))) {
      throw new Error('Valid amount is required');
    }

    try {
      const employee = await this.employeeRepository.findOne({
        where: { userId: userId }
      });

      if (employee) {
        data.employeeId = employee.id;
      }

      // If no currency provided, default to USD
      if (!data.currency) {
        data.currency = 'INR';
      }

      const newExpense = this.expenseRepository.create(data);
      return await this.expenseRepository.save(newExpense);
    } catch (error) {
      console.error('ERROR: Failed to save expense:', error);
      throw error;
    }
  }


  async generateMonthlyPayroll(month: number, year: number) {
    // Get all employees with company relation to read policy settings
    const employees = await this.employeeRepository.find({ relations: ['company'] });

    // Default payroll settings (overridden by per-company config when available)
    const defaultWorkingHours = 8;
    const defaultOvertimeRate = 100;
    const defaultFreeLeaves = 4;
    const defaultHalfPercent = 50;

    let totalBasic = 0;
    let totalNet = 0;
    let totalDeduction = 0;
    let payrolls: any[] = [];

    for (const emp of employees) {
      // Prevent duplicate payroll for the same month/year
      const existing = await this.payrollRepository.findOne({
        where: { employeeId: emp.id, month, year },
      });
      if (existing) continue;

      // Get attendance for this employee for the month
      const attendance = await this.attendanceRepository.find({
        where: { employeeId: emp.id },
      });

      let halfDays = 0;
      let leaveDays = 0;
      let absentDays = 0;
      let overtimeHours = 0;

      for (const att of attendance) {
        const attDate = new Date(att.date);
        if (attDate.getMonth() + 1 !== month || attDate.getFullYear() !== year)
          continue;

        let hoursWorked = 0;
        if (att.checkInTime && att.checkOutTime) {
          const inTime = new Date(att.checkInTime);
          const outTime = new Date(att.checkOutTime);
          hoursWorked = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
        }

        if (att.status === 'half-day') halfDays++;
        if (att.status === 'leave') leaveDays++;
        if (att.status === 'absent') absentDays++;

        if (hoursWorked > defaultWorkingHours) {
          overtimeHours += hoursWorked - defaultWorkingHours;
        }
      }

      const basicSalary = this.parseSalary(emp.salary) || 20000;
      const perDay = basicSalary / 30;

      // Use company-configured half-day pay percent if available, else default to 50%
      const halfPercent = emp.company?.halfDayPayPercent ?? defaultHalfPercent;
      const freeLeaves = defaultFreeLeaves;

      // Leaves deduction logic: first N leaves free
      const extraLeaves = leaveDays > freeLeaves ? leaveDays - freeLeaves : 0;
      const leaveDeduction = extraLeaves * perDay + absentDays * perDay;

      // Half-day deduction uses company-configured percentage
      const halfDeduction = halfDays * (perDay * (halfPercent / 100));

      // Overtime pay
      const overtimePay = overtimeHours * defaultOvertimeRate;

      // Final net salary
      const netSalary = basicSalary - leaveDeduction - halfDeduction + overtimePay;

      totalBasic += basicSalary;
      totalNet += netSalary;
      totalDeduction += leaveDeduction + halfDeduction;

      // Save payroll record (persist the actual percent used for audit trail)
      const payroll = this.payrollRepository.create({
        employeeId: emp.id,
        companyId: emp.companyId,
        basicSalary,
        netSalary,
        month,
        year,
        workingHoursPerDay: defaultWorkingHours,
        overtimeRate: defaultOvertimeRate,
        freeLeaves,
        halfDayPercent: halfPercent,
        status: 'unpaid',
      });

      await this.payrollRepository.save(payroll);

      // 🔥 Real-time Notification to Employee
      try {
        console.log(`[FinanceService] Notifying employee ${emp.id} of payroll generation. Net Salary: ${netSalary}`);
        await this.notificationsService.send({
          title: 'Difmo Pvt Ltd: Payroll Generated',
          message: `Your payroll for ${month}/${year} has been generated. Net Salary: ₹${netSalary.toFixed(2)}.`,
          type: 'both',
          recipientFilter: 'employees',
          recipientIds: [emp.userId],
          companyId: emp.companyId,
          metadata: {
            type: 'PAYROLL_GENERATED',
            month,
            year,
            netSalary,
            basicSalary: emp.salary,
            employeeName: emp.user ? `${emp.user.firstName} ${emp.user.lastName}` : 'Employee'
          }
        });
      } catch (err) {
        console.error(`[FinanceService] Failed to notify employee ${emp.id}:`, err.message);
      }

      payrolls.push({
        employeeId: emp.id,
        basicSalary,
        leaveDeduction,
        halfDeduction,
        overtimePay,
        netSalary,
      });
    }

    // Summary at month end
    const summary = {
      month,
      year,
      totalBasic,
      totalNet,
      totalDeduction,
      employeeCount: payrolls.length,
    };

    return { message: 'Monthly Payroll Generated ', summary, payrolls };
  }


  async generatePayroll(payload: { attendanceId: string; month: number; year: number }) {
    const { attendanceId, month, year } = payload;

    // 1️⃣ Find attendance
    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId },
    });

    if (!attendance) throw new Error('Attendance not found');
    if (!attendance.employeeId) throw new Error('Attendance has no employeeId');

    // 2️⃣ Find employee
    const emp = await this.employeeRepository.findOne({
      where: { id: attendance.employeeId },
    });

    if (!emp) throw new Error('Employee not found');

    // 3️⃣ Default settings (you can also store in DB if needed)
    const basicSalary = this.parseSalary(emp.salary) || 20000;
    const workingHours = 8;       // per day
    const overtimeRate = 100;     // per hour
    const freeLeaves = 4;         // first 4 leaves free
    const halfPercent = 50;       // half-day deduction %

    // 4️⃣ Attendance calculations
    let hoursWorked = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let absentDays = 0;

    // check in/out hours
    if (attendance.checkInTime && attendance.checkOutTime) {
      const inTime = new Date(attendance.checkInTime);
      const outTime = new Date(attendance.checkOutTime);
      hoursWorked = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60); // hours
    }

    // status checks
    if (attendance.status === 'half-day') halfDays++;
    if (attendance.status === 'leave') leaveDays++;
    if (attendance.status === 'absent') absentDays++;

    // 5️⃣ Calculations
    const perDay = basicSalary / 30;

    // leave deduction logic
    const extraLeaves = leaveDays > freeLeaves ? leaveDays - freeLeaves : 0;
    const leaveDeduction = extraLeaves * perDay + absentDays * perDay;

    // half-day deduction
    const halfDeduction = halfDays * (perDay * (halfPercent / 100));

    // overtime pay
    const overtimePay = hoursWorked > workingHours ? (hoursWorked - workingHours) * overtimeRate : 0;

    // net salary
    const netSalary = basicSalary - leaveDeduction - halfDeduction + overtimePay;

    // 6️⃣ Save payroll
    const payroll = this.payrollRepository.create({
      employeeId: emp.id,
      companyId: emp.companyId,
      basicSalary,
      deductions: leaveDeduction + halfDeduction,
      netSalary,
      month,
      year,
      workingHoursPerDay: workingHours,
      overtimeRate,
      freeLeaves,
      halfDayPercent: halfPercent,
      status: 'unpaid',
    });

    await this.payrollRepository.save(payroll);

    // 7️⃣ Return detailed info
    return {
      message: 'Payroll Generated ',
      payroll: {
        employeeId: emp.id,
        basicSalary,
        leaveDeduction,
        halfDeduction,
        overtimePay,
        netSalary,
        month,
        year,
      },
    };
  }

  async generatePayrollSingle(attendanceId: string) {
    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId },
      relations: ['employee']
    });

    if (!attendance) throw new Error('Attendance not found');
    if (!attendance.employee) throw new Error('Employee not found for this attendance');

    const companyId = attendance.employee.companyId;
    const basicSalary = this.parseSalary(attendance.employee.salary) || 20000;

    console.log(`[FinanceService] Generating single payroll for employee ${attendance.employeeId}. Basic Salary: ${basicSalary}`);

    return this.payrollRepository.save({
      employeeId: attendance.employeeId,
      companyId: companyId,
      basicSalary: basicSalary,
      netSalary: basicSalary, // Simplified for single generation
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      status: 'unpaid'
    });
  }

  async generatePayrollSlip(payrollId: string): Promise<Buffer> {
    const payroll = await this.payrollRepository.findOne({
      where: { id: payrollId },
      relations: ['employee', 'employee.user', 'employee.department', 'employee.designation'],
    });

    if (!payroll) throw new Error('Payroll not found');

    const emp = payroll.employee;
    const user = emp?.user;
    const basicSalary = Number(payroll.basicSalary || 0);
    const deductions = Number(payroll.deductions || 0);
    const allowances = Number(payroll.allowances || 0);
    const netSalary = Number(payroll.netSalary || 0);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: any[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Logo & Header
    try {
      const logoUrl = 'https://res.cloudinary.com/dxju8ikk4/image/upload/v1777469595/difmo_vector_icon.png';
      const logoResponse = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      doc.image(logoResponse.data, 40, 40, { width: 50 });
    } catch (e) {
      console.error('Failed to load logo for PDF:', e.message);
    }

    doc.fillColor('#333').fontSize(22).font('Helvetica-Bold').text('Salary Slip', 100, 45, { align: 'right' });
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, 100, 75, { align: 'right' });

    // Divider
    doc.moveTo(40, 100).lineTo(555, 100).strokeColor('#e2e8f0').lineWidth(2).stroke();

    // Title Section
    doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(`${new Date(0, payroll.month - 1).toLocaleString('default', { month: 'long' })} ${payroll.year} Payroll Statement`, 40, 115);

    // Helper for drawing tables
    const drawRow = (y, label1, val1, label2, val2) => {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text(label1.toUpperCase(), 50, y);
      doc.font('Helvetica').fillColor('#0f172a').text(String(val1 || 'N/A'), 160, y);
      if (label2) {
        doc.font('Helvetica-Bold').fillColor('#64748b').text(label2.toUpperCase(), 300, y);
        doc.font('Helvetica').fillColor('#0f172a').text(String(val2 || 'N/A'), 410, y);
      }
      doc.moveTo(40, y + 15).lineTo(555, y + 15).strokeColor('#f1f5f9').lineWidth(1).stroke();
    };

    // Employee Details Section
    let currentY = 145;
    doc.rect(40, currentY, 515, 20).fill('#f8fafc');
    doc.fillColor('#0f172a').font('Helvetica-Bold').text('EMPLOYEE INFORMATION', 50, currentY + 6);
    currentY += 30;

    drawRow(currentY, 'Employee Name', user ? `${user.firstName} ${user.lastName}` : 'N/A', 'Designation', emp?.designation?.name || 'N/A'); currentY += 22;
    drawRow(currentY, 'Employee ID', emp?.employeeCode || 'N/A', 'Department', emp?.department?.name || 'N/A'); currentY += 35;

    // Salary Components
    doc.rect(40, currentY, 515, 20).fill('#f8fafc');
    doc.fillColor('#0f172a').font('Helvetica-Bold').text('SALARY BREAKDOWN', 50, currentY + 6);
    doc.text('AMOUNT (INR)', 450, currentY + 6, { align: 'right', width: 95 });
    currentY += 30;

    const drawSalaryRow = (y, label, val, isTotal = false) => {
      doc.fontSize(isTotal ? 11 : 10).font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor(isTotal ? '#ffffff' : '#1e293b').text(label, 50, y);
      doc.text(`${Number(val).toFixed(2)}`, 450, y, { align: 'right', width: 95 });
      if (!isTotal) doc.moveTo(40, y + 15).lineTo(555, y + 15).strokeColor('#f1f5f9').stroke();
    };

    drawSalaryRow(currentY, 'Basic Salary', basicSalary); currentY += 22;
    drawSalaryRow(currentY, 'Allowances & Bonuses', allowances); currentY += 22;
    drawSalaryRow(currentY, 'Total Deductions', deductions); currentY += 25;

    doc.rect(40, currentY - 5, 515, 30).fill('#0f172a');
    drawSalaryRow(currentY + 5, 'NET PAYABLE SALARY (INR)', netSalary, true);
    currentY += 50;

    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('Attendance Summary', 40, currentY);
    currentY += 20;
    doc.fontSize(10).font('Helvetica').fillColor('#64748b');
    doc.text(`Total Days: 24  |  Worked: 24  |  Leaves: 0`, 40, currentY);
    currentY += 60;

    doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#000').lineWidth(1).stroke();
    currentY += 25;

    const sigX = 50;
    const contactX = 350;

    // Identity Column (Left)
    doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Team DIFMO', sigX, currentY);
    doc.fontSize(10).font('Helvetica').fillColor('#1e293b').text('Corporate Support', sigX, currentY + 18);
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#475569').text('Communications & Experience', sigX, currentY + 30);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('DIFMO Technologies Pvt Ltd', sigX, currentY + 45);

    // Contact Column (Right) - Starting at same Y
    const drawContact = (y, icon, text) => {
      doc.rect(contactX, y, 14, 14).fill('#000');
      doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold').text(icon, contactX, y + 3, { align: 'center', width: 14 });
      doc.fillColor('#000').fontSize(10).font('Helvetica').text(text, contactX + 25, y + 2);
    };

    drawContact(currentY, 'E', 'info@difmo.com');
    drawContact(currentY + 20, 'A', '4/37 Vibhav Khand, Gomtinagr Lucknow, Uttar Pradesh 226016, India');
    drawContact(currentY + 40, 'W', 'www.difmo.com');

    // Second Row: The Banner Image
    currentY += 75;
    try {
      const avatarUrl = 'https://res.cloudinary.com/dxju8ikk4/image/upload/v1777468072/difmo_banner_final.png';
      const avatarResponse = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
      doc.image(avatarResponse.data, 40, currentY, { width: 515 });
      currentY += 120; // Adjust for banner height
    } catch (e) { }

    currentY += 20;
    doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#000').lineWidth(1).stroke();

    doc.fontSize(7).fillColor('#94a3b8').text('CONFIDENTIAL: This document contains proprietary information and is intended for the named employee only. © 2026 DIFMO PRIVATE LIMITED.', 40, 780, { align: 'center' });

    doc.end();

    return new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }


  async markPayrollPaid(payrollId: string) {
    const payroll = await this.payrollRepository.findOne({
      where: { id: payrollId },
      relations: ['employee']
    });

    if (!payroll) throw new NotFoundException('Payroll not found');

    payroll.status = 'paid';
    const updated = await this.payrollRepository.save(payroll);
    try {
      const emp = await this.employeeRepository.findOne({
        where: { id: payroll.employeeId },
        relations: ['user']
      });
      if (emp && emp.userId) {
        const netSal = this.parseSalary(payroll.netSalary);
        console.log(`[FinanceService] Notifying employee ${emp.id} of payroll payment. Amount: ${netSal}`);
        await this.notificationsService.send({
          title: 'Difmo Pvt Ltd: Salary Disbursed',
          message: `Your salary for ${payroll.month}/${payroll.year} has been marked as PAID. Amount: ₹${netSal.toFixed(2)}.`,
          type: 'both',
          recipientFilter: 'employees',
          recipientIds: [emp.userId],
          companyId: payroll.companyId,
          metadata: {
            type: 'PAYROLL_PAID',
            month: payroll.month,
            year: payroll.year,
            netSalary: netSal,
            status: 'paid',
            employeeName: emp.user ? `${emp.user.firstName} ${emp.user.lastName}` : 'Employee'
          }
        });
      }
    } catch (err) {
      console.error(`[FinanceService] Failed to notify employee on payroll payment:`, err.message);
    }

    return updated;
  }

  async findAllExpenses(companyId: string, targetCurrency: string = 'INR'): Promise<any[]> {
    const expenses = await this.expenseRepository.find({
      where: { companyId },
      relations: ['employee', 'employee.user'],
      order: { date: 'DESC' }
    });

    return expenses.map(e => {
      const amount = Number(e.amount);
      return {
        ...e,
        originalAmount: amount,
        originalCurrency: e.currency,
        // Converts from whatever was saved (e.g., USD) into INR
        amount: this.convert(amount, e.currency, targetCurrency),
        currency: targetCurrency.toUpperCase()
      };
    });
  }

  async deleteExpense(id: string): Promise<{ message: string }> {
    const expense = await this.expenseRepository.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    await this.expenseRepository.remove(expense);
    return { message: 'Expense deleted successfully' };
  }

  // turnover & summary
  async getFinancialSummary(companyId: string, month?: number, year?: number, targetCurrency: string = 'INR') {
    const where: any = { companyId };

    let expenses = await this.expenseRepository.find({ where });
    let payrolls = await this.payrollRepository.find({ where: { ...where, status: 'paid' } });

    if (month || year) {
      expenses = expenses.filter(e => {
        const d = new Date(e.date);
        const mMatch = month ? (d.getMonth() + 1) === Number(month) : true;
        const yMatch = year ? d.getFullYear() === Number(year) : true;
        return mMatch && yMatch;
      });

      payrolls = payrolls.filter(p => {
        const mMatch = month ? Number(p.month) === Number(month) : true;
        const yMatch = year ? Number(p.year) === Number(year) : true;
        return mMatch && yMatch;
      });
    }

    // Normalized totals (all converted to targetCurrency)
    const totalDebit = expenses
      .filter((e) => e.type === 'debit' || e.type === 'expense')
      .reduce((sum, e) => sum + this.convert(Number(e.amount), e.currency, targetCurrency), 0);

    const totalCredit = expenses
      .filter((e) => e.type === 'credit' || e.type === 'income')
      .reduce((sum, e) => sum + this.convert(Number(e.amount), e.currency, targetCurrency), 0);

    // Filter payrolls for those specifically in this period if possible, 
    // though payroll records usually have month/year fields.
    const totalPayroll = payrolls.reduce(
      (sum, p) => sum + this.convert(Number(p.netSalary), 'INR', targetCurrency),
      0,
    );

    const totalOutgoing = totalDebit + totalPayroll;

    return {
      totalDebit,
      totalCredit,
      totalExpenses: totalDebit,
      totalPayroll,
      grandTotalOutgoing: totalOutgoing,
      turnover: totalCredit, // Using totalCredit/income as turnover
      netBalance: totalCredit - totalOutgoing,
      expenseCount: expenses.length,
      payrollCount: payrolls.length,
      currency: targetCurrency.toUpperCase()
    };
  }

  async updatePayroll(id: string, data: Partial<Payroll>): Promise<Payroll> {
    const payroll = await this.payrollRepository.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll not found');

    // Recalculate net salary if components changed
    if (data.basicSalary !== undefined || data.allowances !== undefined || data.deductions !== undefined) {
      const basic = Number(data.basicSalary !== undefined ? data.basicSalary : payroll.basicSalary);
      const allowances = Number(data.allowances !== undefined ? data.allowances : (payroll.allowances || 0));
      const deductions = Number(data.deductions !== undefined ? data.deductions : (payroll.deductions || 0));
      data.netSalary = basic + allowances - deductions;
    }

    Object.assign(payroll, data);
    return this.payrollRepository.save(payroll);
  }

  async deletePayroll(id: string): Promise<{ message: string }> {
    const payroll = await this.payrollRepository.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll not found');
    await this.payrollRepository.remove(payroll);
    return { message: 'Payroll deleted successfully' };
  }

  async sendPayrollEmail(id: string) {
    const payroll = await this.payrollRepository.findOne({
      where: { id },
      relations: ['employee', 'employee.user']
    });

    if (!payroll) throw new NotFoundException('Payroll not found');
    if (!payroll.employee?.user?.email) throw new Error('Employee email not found');

    const netSal = this.parseSalary(payroll.netSalary);

    // Generate PDF for attachment
    const pdfBuffer = await this.generatePayrollSlip(id);

    await this.notificationsService.send({
      title: 'Difmo Pvt Ltd: Payroll Slip Generated',
      message: `Your payroll for ${payroll.month}/${payroll.year} has been generated. Please find the attached payslip for your records.`,
      type: 'email',
      recipientFilter: 'employees',
      recipientIds: [payroll.employee.userId],
      companyId: payroll.companyId,
      attachments: [
        {
          filename: `Payslip_${payroll.month}_${payroll.year}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ],
      metadata: {
        type: 'PAYROLL_GENERATED',
        month: payroll.month,
        year: payroll.year,
        netSalary: netSal
      }
    });

    return { message: 'Email sent successfully with attachment' };
  }
}
