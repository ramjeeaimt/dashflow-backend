import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll } from './entities/payroll.entity';
import { Expense } from './entities/expense.entity';
import { Company } from '../companies/company.entity';
import { Employee } from '../employees/employee.entity';
import { Attendance } from '../attendance/attendance.entity';
import  PDFDocument  from 'pdfkit';

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

  // Payroll
  async createPayroll(data: Partial<Payroll>): Promise<Payroll> {
    return this.payrollRepository.save(this.payrollRepository.create(data));
  }
  //   async generatePayroll(data: Partial<Payroll>): Promise<Payroll> {
  //   return this.payrollRepository.save(this.payrollRepository.create(data));
  // }

async findAllPayroll(
  employeeId: string, // Changed from attendanceId
  month?: number,
  year?: number,
): Promise<Payroll[]> {
  const where: any = { employeeId }; // Search by employeeId
  
  if (month) where.month = Number(month);
  if (year) where.year = Number(year);

  return this.payrollRepository.find({
    where,
    relations: ['employee', 'employee.user'],
    order: { year: 'DESC', month: 'DESC' } // Newest first
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
        data.currency = 'USD';
      }

      const newExpense = this.expenseRepository.create(data);
      return await this.expenseRepository.save(newExpense);
    } catch (error) {
      console.error('ERROR: Failed to save expense:', error);
      throw error;
    }
  }
async generateMonthlyPayroll(month: number, year: number) {
  // Get all employees
  const employees = await this.employeeRepository.find();

  // Default payroll settings (can later make this dynamic per admin input)
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

    const basicSalary = Number(emp.salary) || 20000; // Employee base salary
    const perDay = basicSalary / 30;

    // Leaves deduction logic: first 4 leaves free
    const extraLeaves = leaveDays > defaultFreeLeaves ? leaveDays - defaultFreeLeaves : 0;
    const leaveDeduction = extraLeaves * perDay + absentDays * perDay;

    // Half-day deduction
    const halfDeduction = halfDays * (perDay * (defaultHalfPercent / 100));

    // Overtime pay
    const overtimePay = overtimeHours * defaultOvertimeRate;

    // Final net salary
    const netSalary = basicSalary - leaveDeduction - halfDeduction + overtimePay;

    totalBasic += basicSalary;
    totalNet += netSalary;
    totalDeduction += leaveDeduction + halfDeduction;

    // Save payroll record
    const payroll = this.payrollRepository.create({
      employeeId: emp.id,
      companyId: emp.companyId,
      basicSalary,
      netSalary,
      month,
      year,
      workingHoursPerDay: defaultWorkingHours,
      overtimeRate: defaultOvertimeRate,
      freeLeaves: defaultFreeLeaves,
      halfDayPercent: defaultHalfPercent,
      status: 'unpaid',
    });

    await this.payrollRepository.save(payroll);

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
  const basicSalary = Number(emp.salary) || 20000;
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
    where: { id: attendanceId }
  });

  if (!attendance) throw new Error('Attendance not found');

  return this.payrollRepository.save({
    employeeId: attendance.employeeId,
    companyId: attendance.employee?.companyId || attendance.employeeId, // Fallback logic
    
    basicSalary: 30000,
    netSalary: 30000,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: 'unpaid'
  });
}

async generatePayrollSlip(payrollId: string): Promise<Buffer> {
  const payroll = await this.payrollRepository.findOne({
    where: { id: payrollId },
    relations: ['employee'],
  });

  if (!payroll) throw new Error('Payroll not found');

  //  CONVERT VALUES
  const basicSalary = Number(payroll.basicSalary || 0);
  const deductions = Number(payroll.deductions || 0);
  const netSalary = Number(payroll.netSalary || 0);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Header
  doc.fontSize(20).text('Payroll Slip', { align: 'center' });
  doc.moveDown();

  // Employee info
  doc.fontSize(12).text(`Employee Name: ${payroll.employee?.id|| 'N/A'}`);
  doc.text(`Employee ID: ${payroll.employee?.id}`);
  doc.text(`Month/Year: ${payroll.month}/${payroll.year}`);
  doc.moveDown();

  // Salary breakdown  FIXED
  doc.text(`Basic Salary: ₹${basicSalary.toFixed(2)}`);
  doc.text(`Leave Deduction: ₹${deductions.toFixed(2)}`);
  doc.text(`Overtime Pay: ₹${payroll.overtimeRate || 0}`);
  doc.text(`Net Salary: ₹${netSalary.toFixed(2)}`);
  doc.text(`Status: ${payroll.status}`);
  doc.moveDown();

  doc.text(
    'This is a computer-generated slip and does not require signature.',
    { align: 'center' }
  );

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: any[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  return pdfBuffer;
}


  async markPayrollPaid(payrollId: string) {
    const payroll = await this.payrollRepository.findOne({
      where: { id: payrollId }
    });

    if (!payroll) throw new NotFoundException('Payroll not found');

    payroll.status = 'paid';

    return this.payrollRepository.save(payroll);
  }

  async findAllExpenses(companyId: string, targetCurrency: string = 'USD'): Promise<any[]> {
    const expenses = await this.expenseRepository.find({
      where: { companyId },
      relations: ['employee', 'employee.user'],
      order: { date: 'DESC' }
    });

    return expenses.map(e => ({
      ...e,
      originalAmount: Number(e.amount),
      originalCurrency: e.currency,
      amount: this.convert(Number(e.amount), e.currency, targetCurrency),
      currency: targetCurrency.toUpperCase()
    }));
  }

  // turnover & summary
  async getFinancialSummary(companyId: string, month?: number, year?: number, targetCurrency: string = 'USD') {
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
      .filter((e) => e.type !== 'credit')
      .reduce((sum, e) => sum + this.convert(Number(e.amount), e.currency, targetCurrency), 0);

    const totalCredit = expenses
      .filter((e) => e.type === 'credit')
      .reduce((sum, e) => sum + this.convert(Number(e.amount), e.currency, targetCurrency), 0);

    // Assuming payroll record salaries are in a base currency (USD) for this simplicity, 
    // or we could add a currency field to payroll too if needed.
    const totalPayroll = payrolls.reduce(
      (sum, p) => sum + this.convert(Number(p.netSalary), 'USD', targetCurrency),
      0,
    );

    return {
      totalDebit,
      totalCredit,
      totalExpenses: totalDebit,
      totalPayroll,
      grandTotalOutgoing: totalDebit + totalPayroll,
      turnover: this.convert(500000, 'USD', targetCurrency) + totalCredit,
      expenseCount: expenses.length,
      payrollCount: payrolls.length,
      currency: targetCurrency.toUpperCase()
    };
  }
}
