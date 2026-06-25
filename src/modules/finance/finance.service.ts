import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import { Payroll } from './entities/payroll.entity';
import { Expense } from './entities/expense.entity';
import { Company } from '../companies/company.entity';
import { Employee } from '../employees/employee.entity';
import { Attendance } from '../attendance/attendance.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import puppeteer from 'puppeteer-core';
const chromium = require('@sparticuz/chromium');
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

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly notificationsService: NotificationsService,

  ) { }

  // Exchange rates relative to 1 USD
  private readonly rates = {
    USD: 1,
    INR: 93.5,
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
    return parseFloat((inUsd * toRate).toFixed(2));
  }

  /**
   * Calculates the exact number of active working days in a specific month based on company settings
   */
  private getExactWorkingDaysInMonth(year: number, month: number, workingDaysArr?: string[]): number {
    if (!workingDaysArr || workingDaysArr.length === 0) {
      return 30; // Fallback
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month - 1, i);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (workingDaysArr.includes(dayName)) {
        count++;
      }
    }
    return count;
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

    //  Real-time Notification to Employee on Creation
    try {
      const emp = await this.employeeRepository.findOne({
        where: { id: payroll.employeeId },
        relations: ['user']
      });
      if (emp && emp.userId) {
        const netSal = this.parseSalary(payroll.netSalary);
        console.log(`[FinanceService] Notifying employee ${emp.id} of payroll creation. Net Salary: ${netSal}`);
        await this.notificationsService.send({
          title: 'Difmo Pvt Ltd: Salary Slip Generated',
          message: `Your salary slip for ${payroll.month}/${payroll.year} has been generated. Net Salary: ₹${netSal.toFixed(2)}.`,
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

        // 🔥 Real-time Notification to Admin or Custom Emails
        console.log(`[FinanceService] Notifying Admin/Custom of payroll creation for ${emp.id}`);

        const company = await this.companyRepository.findOne({ where: { id: payroll.companyId } });
        let alertEmails: string[] = [];
        let alertUserIds: string[] = [];
        let filter: any = 'admin';

        if (company && company.payrollAlertEmails) {
          alertEmails = company.payrollAlertEmails.split(',').map(e => e.trim()).filter(Boolean);
          if (alertEmails.length > 0) {
            filter = 'custom';
            const adminUsers = await this.userRepository.createQueryBuilder('user')
              .where('user.companyId = :companyId', { companyId: payroll.companyId })
              .andWhere('user.email IN (:...emails)', { emails: alertEmails })
              .getMany();
            alertUserIds = adminUsers.map(u => u.id);
          }
        }

        await this.notificationsService.send({
          title: `Payroll Generated for ${emp.user ? emp.user.firstName : 'Employee'}`,
          message: `Payroll for ${payroll.month}/${payroll.year} has been generated for ${emp.user ? `${emp.user.firstName} ${emp.user.lastName}` : 'Employee'}.`,
          type: 'both',
          recipientFilter: filter,
          recipientEmails: filter === 'custom' ? alertEmails : undefined,
          recipientIds: filter === 'custom' ? alertUserIds : undefined,
          companyId: payroll.companyId,
          metadata: {
            type: 'PAYROLL_GENERATED',
            month: payroll.month,
            year: payroll.year,
            netSalary: netSal,
            basicSalary: payroll.basicSalary,
            deductions: payroll.deductions,
            allowances: payroll.allowances,
            employeeName: `Admin (for ${emp.user ? emp.user.firstName : 'Employee'})`
          }
        });
      }
    } catch (err) {
      console.error(`[FinanceService] Failed to notify employee/admin on payroll creation:`, err.message);
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
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.company', 'company')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.designation', 'designation');

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
    query.orderBy('payroll.updatedAt', 'DESC')
      .addOrderBy('payroll.id', 'ASC'); // ID par order dene se duplicates identify karna easy hota hai

    const results = await query.getMany();

    // 6. Final Safety Net: DB duplicates hatane ke liye (Group by employeeId + month + year)
    const latestPayrollsMap = new Map();
    for (const item of results) {
      const key = `${item.employeeId}-${item.month}-${item.year}`;
      if (!latestPayrollsMap.has(key)) {
        latestPayrollsMap.set(key, item);
      } else {
        const existing = latestPayrollsMap.get(key);
        if (new Date(item.updatedAt) > new Date(existing.updatedAt)) {
          latestPayrollsMap.set(key, item);
        }
      }
    }
    const uniquePayrolls = Array.from(latestPayrollsMap.values());

    // 7. Calculate yearly leaves taken for each employee in the target year
    const queryYear = year || new Date().getFullYear();
    try {
      const yearlyLeaves = await this.payrollRepository.createQueryBuilder('p')
        .select('p.employeeId', 'employeeId')
        .addSelect('SUM(p.paidLeaves)', 'totalPaidLeaves')
        .where('p.year = :year', { year: queryYear })
        .groupBy('p.employeeId')
        .getRawMany();

      const yearlyLeavesMap = new Map(
        yearlyLeaves.map(item => [item.employeeId, Number(item.totalPaidLeaves) || 0])
      );

      uniquePayrolls.forEach(p => {
        (p as any).yearlyLeavesTaken = yearlyLeavesMap.get(p.employeeId) || 0;
      });
    } catch (err) {
      console.error('[FinanceService] Failed to calculate yearly leaves:', err);
    }

    return uniquePayrolls;
  }

  async findEmployeeByUserId(userId: string) {
    return this.employeeRepository.findOne({
      where: { userId: userId }
    });
  }

  // --- Notifications Helper ---
  private async notifyFinanceActivity(companyId: string, title: string, message: string, type: 'both' | 'push', expenseData: any) {
    try {
      const company = await this.companyRepository.findOne({ where: { id: companyId } });
      const emails = new Set<string>();
      const userIds = new Set<string>();

      // Get Custom Emails from policy
      if (company && company.payrollAlertEmails) {
        const policyEmails = company.payrollAlertEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        policyEmails.forEach(e => emails.add(e));

        if (policyEmails.length > 0) {
          const policyUsers = await this.userRepository.createQueryBuilder('user')
            .where('LOWER(user.email) IN (:...emails)', { emails: policyEmails })
            .getMany();
          policyUsers.forEach(u => userIds.add(u.id));
        }
      }

      // Send Notification
      // We use 'admin' filter to automatically target all admins.
      // Custom emails/userIds passed will simply be appended to the list by NotificationsService.
      await this.notificationsService.send({
        title,
        message,
        type,
        recipientFilter: 'admin',
        recipientEmails: Array.from(emails),
        recipientIds: Array.from(userIds),
        companyId,
        metadata: {
          type: 'FINANCE_UPDATE',
          expenseId: expenseData?.id,
          amount: expenseData?.amount,
          title: expenseData?.title,
          entryType: expenseData?.entryType,
          currency: expenseData?.currency,
          financeStatus: expenseData?.status,
          category: expenseData?.category,
          entryDate: expenseData?.date,
          month: expenseData?.month,
          year: expenseData?.year,
          employeeName: expenseData?.employeeName,
          financeType: expenseData?.financeType,
          description: expenseData?.description,
          click_action: '/finance',
        }
      });
    } catch (err) {
      console.error('[FinanceService] Failed to notify finance activity:', err.message);
    }
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

      if (data.amount !== undefined) {
        data.amount = parseFloat(Number(data.amount).toFixed(2));
      }

      const newExpense = this.expenseRepository.create(data);
      const saved = await this.expenseRepository.save(newExpense);

      // Notify (Email + FCM)
      const isCredit = saved.type === 'credit' || saved.type === 'income';
      const typeStr = isCredit ? 'Income' : 'Expense';
      const statusDisplay = saved.status === 'pending' ? 'Requested' : 'Approved';

      const employeeName = employee ? `${employee.user?.firstName || ''} ${employee.user?.lastName || ''}`.trim() : undefined;

      this.notifyFinanceActivity(
        saved.companyId,
        `Financial Entry ${statusDisplay}: ${saved.title}`,
        `A new ${typeStr.toLowerCase()} of ${saved.currency} ${saved.amount} has been ${statusDisplay.toLowerCase()}.`,
        'both',
        {
          id: saved.id,
          entryType: 'Expense',
          title: saved.title,
          amount: saved.amount,
          currency: saved.currency,
          financeType: saved.type,
          category: saved.category,
          status: saved.status,
          date: saved.date,
          description: saved.description,
          employeeName: employeeName
        }
      );

      return saved;
    } catch (error) {
      console.error('ERROR: Failed to save expense:', error);
      throw error;
    }
  }


  async generateMonthlyPayroll(month: number, year: number, companyId: string, employeeId?: string) {
    // Get all employees with company relation to read policy settings
    const whereClause: any = { companyId };
    if (employeeId) {
      whereClause.id = employeeId;
    }
    const employees = await this.employeeRepository.find({
      where: whereClause,
      relations: ['company']
    });

    // Default payroll settings (overridden by per-company config when available)
    const defaultWorkingHours = 8;
    const defaultOvertimeRate = 100;
    const defaultFreeLeaves = 1;
    const defaultHalfPercent = 50;

    let totalBasic = 0;
    let totalNet = 0;
    let totalDeduction = 0;
    let payrolls: any[] = [];

    for (const emp of employees) {
      const existing = await this.payrollRepository.findOne({
        where: { employeeId: emp.id, month, year },
      });
      if (existing) {
        if (existing.status === 'sent' || existing.status === 'paid') {
          continue; // Skip if already finalized
        } else if (!employeeId) {
          // If bulk generating (no specific employee), skip existing drafts!
          continue;
        } else {
          // If generating for a specific employee, remove the draft to recalculate
          await this.payrollRepository.remove(existing);
        }
      }

      // Get attendance for this employee for the month
      const attendance = await this.attendanceRepository.find({
        where: { employeeId: emp.id },
      });

      let presentDays = 0;
      let halfDays = 0;
      let leaveDays = 0;
      let absentDays = 0;
      let totalDailyOvertime = 0;
      let totalDailyUndertime = 0;

      for (const att of attendance) {
        const attDate = new Date(att.date);
        if (attDate.getMonth() + 1 !== month || attDate.getFullYear() !== year)
          continue;

        let hoursWorked = 0;
        if (att.checkInTime && att.checkOutTime) {
          const inStr = String(att.checkInTime).includes('T') ? String(att.checkInTime) : `1970-01-01T${att.checkInTime}Z`;
          const outStr = String(att.checkOutTime).includes('T') ? String(att.checkOutTime) : `1970-01-01T${att.checkOutTime}Z`;
          const inTime = new Date(inStr);
          const outTime = new Date(outStr);
          hoursWorked = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
          if (hoursWorked > 6) {
            hoursWorked -= 1;
          }
        }

        if (['present', 'late', 'early_checkin', 'early_departure', 'wfh'].includes(att.status)) {
          presentDays++;

          // Calculate overtime and undertime only for present-type days
          if (hoursWorked > defaultWorkingHours) {
            totalDailyOvertime += (hoursWorked - defaultWorkingHours);
          } else if (hoursWorked < defaultWorkingHours) {
            totalDailyUndertime += (defaultWorkingHours - hoursWorked);
          }
        }
        if (att.status === 'half-day') halfDays++;
        if (att.status === 'leave') leaveDays++;
        if (att.status === 'absent') absentDays++;
      }

      let overtimeHours = Math.max(0, totalDailyOvertime - totalDailyUndertime);

      const basicSalary = Number(this.parseSalary(emp.salary)) || 0;

      // Calculate Exact Working Days for Per Day calculation
      const workingDaysArr = emp.company?.workingDays;
      const exactWorkingDaysInMonth = Number(this.getExactWorkingDaysInMonth(year, month, workingDaysArr)) || 22;

      // Calculate missing working days (unattended/unlogged days) as absent days
      const missingDays = Math.max(0, exactWorkingDaysInMonth - (presentDays + halfDays + leaveDays + absentDays));
      absentDays += missingDays;

      const perDay = exactWorkingDaysInMonth > 0 ? (basicSalary / exactWorkingDaysInMonth) : 0;

      // Use company-configured half-day pay percent if available, else default to 50%
      const halfPercent = Number(emp.company?.halfDayPayPercent) || defaultHalfPercent;
      const casualLeavesPerYear = Number(emp.company?.casualLeavesPerYear) || 12;
      const freeLeaves = casualLeavesPerYear / 12;

      // Leaves deduction logic: group Absent and Leave together to consume Free CL
      const totalMissedDays = leaveDays + absentDays;
      const unpaidMissedDays = Math.max(0, totalMissedDays - freeLeaves);
      const leaveDeduction = Number(unpaidMissedDays * perDay) || 0;

      // Half-day deduction uses company-configured percentage
      const halfDeduction = Number(halfDays * (perDay * (halfPercent / 100))) || 0;

      // Fetch dynamic overtime configs
      const overtimePolicy = emp.company?.overtimePolicy || 'fixed';
      let dynamicOvertimeRate = 0;

      if (overtimePolicy === 'fixed') {
        dynamicOvertimeRate = Number(emp.company?.overtimeRatePerHour) || 0;
      } else {
        // Variable Overtime Rate: (Monthly Salary / Total Working Days) / Working Hours Per Day
        const perHour = defaultWorkingHours > 0 ? (perDay / defaultWorkingHours) : 0;
        const percentage = Number(emp.company?.overtimeMultiplier) || 100.0;
        dynamicOvertimeRate = Number(perHour * (percentage / 100.0)) || 0;
      }

      // Overtime pay
      const overtimePay = Number(overtimeHours * dynamicOvertimeRate) || 0;

      // Allowance
      let allowanceAmount = Number(emp.company?.allowanceAmount) || 0;

      // Final net salary calculation
      let baseAfterDeduction = basicSalary - leaveDeduction - halfDeduction;
      if (baseAfterDeduction <= 0) {
        baseAfterDeduction = 0;
        allowanceAmount = 0; // No allowance if completely absent
      }

      const netSalary = Number(baseAfterDeduction + overtimePay + allowanceAmount) || 0;

      totalBasic += basicSalary;
      totalNet += netSalary;
      totalDeduction += leaveDeduction + halfDeduction;

      // Save payroll record as a draft
      const payroll = this.payrollRepository.create({
        employeeId: emp.id,
        companyId: emp.companyId,
        basicSalary: Math.round(basicSalary),
        allowances: Math.round(allowanceAmount),
        deductions: Math.round(leaveDeduction + halfDeduction),
        leaveDeduction: Math.round(leaveDeduction),
        halfDeduction: Math.round(halfDeduction),
        overtime: Math.round(overtimePay),
        netSalary: Math.round(netSalary),
        month,
        year,
        totalWorkingDays: exactWorkingDaysInMonth,
        workDays: presentDays + halfDays,
        paidLeaves: Math.min(totalMissedDays, freeLeaves),
        unpaidLeaves: unpaidMissedDays,
        workingHoursPerDay: Math.round(defaultWorkingHours),
        overtimeRate: Math.round(dynamicOvertimeRate),
        freeLeaves: Math.round(freeLeaves),
        halfDayPercent: Math.round(halfPercent),
        status: 'draft', // Set to draft, requires manual review
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

    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId },
    });
    if (!attendance) throw new Error('Attendance not found');
    if (!attendance.employeeId) throw new Error('Attendance has no employeeId');

    const emp = await this.employeeRepository.findOne({
      where: { id: attendance.employeeId },
      relations: ['company'],
    });
    if (!emp) throw new Error('Employee not found');

    // Delegate to robust monthly bulk generator for accurate monthly aggregation
    const result = await this.generateMonthlyPayroll(month, year, emp.companyId, emp.id);

    if (result.payrolls && result.payrolls.length > 0) {
      return { message: 'Payroll Generated', payroll: result.payrolls[0] };
    }

    return { message: 'Payroll generation skipped or failed', payroll: null };
  }

  async finalizeAndSendPayroll(payrollId: string, payslipHtml: string, emailBodyHtml: string) {
    const payroll = await this.payrollRepository.findOne({
      where: { id: payrollId },
      relations: ['employee', 'employee.user'],
    });

    if (!payroll) throw new NotFoundException('Payroll not found');

    // Save custom HTML templates and sync parsed numeric values to database columns
    payroll.customPayslipHtml = payslipHtml;
    payroll.customEmailBodyHtml = emailBodyHtml;
    this.syncPayrollValuesFromHtml(payroll, payslipHtml);

    // Save early to ensure PDFKit fallback reads the updated numeric values if Puppeteer fails
    await this.payrollRepository.save(payroll);

    const emp = payroll.employee;
    const user = emp?.user;

    let pdfBuffer: Buffer;
    let fallbackReason: string | null = null;
    try {
      // Generate PDF using Puppeteer (Fetch chromium pack on Vercel)
      const executablePath = await chromium.executablePath(
        process.env.NODE_ENV === 'production'
          ? 'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar'
          : undefined
      );

      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: executablePath || '/usr/bin/google-chrome', // fallback for local dev
        headless: chromium.headless === false ? false : true,
      });

      const page = await browser.newPage();
      await page.setContent(payslipHtml, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '50px', bottom: '30px', left: '20px', right: '20px' }
      });
      await browser.close();
    } catch (error) {
      fallbackReason = error.message || 'Unknown memory/timeout limit in Vercel';
      console.warn('[FinanceService] Puppeteer failed in Vercel. Falling back to PDFKit:', fallbackReason);
      pdfBuffer = await this.generatePayrollSlip(payrollId);
    }

    // Collect additional emails
    const additionalEmails: string[] = [];

    try {
      const admins = await this.userRepository.createQueryBuilder('user')
        .leftJoinAndSelect('user.roles', 'role')
        .where('user.companyId = :companyId', { companyId: payroll.companyId })
        .andWhere('LOWER(role.name) IN (:...roleNames)', { roleNames: ['admin', 'super admin', 'superadmin'] })
        .getMany();

      admins.forEach(admin => {
        if (admin.email) additionalEmails.push(admin.email);
      });
    } catch (err) {
      console.error('[FinanceService] Failed to fetch admins for payroll sending', err);
    }

    try {
      const company = await this.companyRepository.findOne({ where: { id: payroll.companyId } });
      if (company && company.payrollAlertEmails) {
        const policyEmails = company.payrollAlertEmails.split(',').map(e => e.trim()).filter(Boolean);
        additionalEmails.push(...policyEmails);
      }
    } catch (err) {
      console.error('[FinanceService] Failed to fetch company policy emails for payroll sending', err);
    }

    const uniqueAdditionalEmails = [...new Set(additionalEmails)];

    const recipientUserIds = [emp.userId];
    if (uniqueAdditionalEmails.length > 0) {
      try {
        const extraUsers = await this.userRepository.find({
          where: { email: In(uniqueAdditionalEmails) },
          select: ['id'],
        });
        extraUsers.forEach(u => {
          if (u.id && !recipientUserIds.includes(u.id)) {
            recipientUserIds.push(u.id);
          }
        });
      } catch (err) {
        console.error('[FinanceService] Failed to fetch user IDs for FCM fallback', err);
      }
    }

    // Send email to Employee
    const empName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Employee';

    if (user && user.email) {
      const notifResult = await this.notificationsService.send({
        title: 'Difmo Pvt Ltd: Salary Slip Generated',
        message: 'Please find attached your salary slip.',
        type: 'both',
        recipientFilter: 'employees',
        recipientIds: [emp.userId],
        recipientEmails: [],
        companyId: payroll.companyId,
        attachments: [
          {
            filename: `${empName.replace(/ /g, '_')}_Salary_slip_${payroll.month}-${payroll.year}.pdf`,
            content: Buffer.from(pdfBuffer),
            contentType: 'application/pdf',
          }
        ],
        metadata: {
          type: 'PAYROLL_FINALIZED',
          month: payroll.month,
          year: payroll.year,
          netSalary: payroll.netSalary,
          useCustomHtml: true, // Use the provided HTML instead of default layout
          customHtml: emailBodyHtml,
        }
      });

      // If email failed to send to employee, throw error.
      if (notifResult && notifResult.successCount === 0 && notifResult.failureCount > 0) {
        throw new Error(`Failed to send email to employee. Please check your email configuration.`);
      }
    } else {
      throw new Error("Employee does not have a valid email address attached.");
    }

    // Send separate email to Admins / Additional Emails
    const extraIds = recipientUserIds.filter(id => id !== emp.userId);
    if (extraIds.length > 0 || uniqueAdditionalEmails.length > 0) {
      await this.notificationsService.send({
        title: `Difmo Pvt Ltd: Salary Slip for ${empName}`,
        message: `The salary slip for ${empName} (${payroll.month}/${payroll.year}) has been generated. Please find it attached.`,
        type: 'both',
        recipientFilter: 'employees',
        recipientIds: extraIds,
        recipientEmails: uniqueAdditionalEmails,
        companyId: payroll.companyId,
        attachments: [
          {
            filename: `${empName.replace(/ /g, '_')}_Salary_slip_${payroll.month}-${payroll.year}.pdf`,
            content: Buffer.from(pdfBuffer),
            contentType: 'application/pdf',
          }
        ],
        metadata: {
          type: 'PAYROLL_FINALIZED_ADMIN',
          month: payroll.month,
          year: payroll.year,
          netSalary: payroll.netSalary,
          useCustomHtml: true,
          customHtml: emailBodyHtml,
        }
      });
    }

    payroll.status = 'sent';
    const saved = await this.payrollRepository.save(payroll);

    // Trigger Finance Notification (Appears in Finance Dashboard)
    const statusDisplay = saved.financeStatus === 'pending' ? 'Requested' : 'Approved';
    const netSalary = saved.netSalary || 0;

    this.notifyFinanceActivity(
      saved.companyId,
      `Financial Entry ${statusDisplay}: Payroll — ${empName}`,
      `A new payroll entry for ${empName} (${saved.month}/${saved.year}) has been added to the finance dashboard. Amount is INR ${netSalary}.`,
      'both',
      {
        id: saved.id,
        entryType: 'Payroll',
        title: `Payroll for ${empName}`,
        amount: netSalary,
        currency: 'INR',
        month: saved.month,
        year: saved.year,
        status: saved.financeStatus,
        description: saved.notes,
        employeeName: empName
      }
    );

    return {
      payroll: saved,
      fallbackUsed: !!fallbackReason,
      fallbackReason
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
    const basicSalary = this.parseSalary(attendance.employee.salary) || 0;

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
    const dbBasicSalary = Number(payroll.basicSalary || 0);
    const dbDeductions = Number(payroll.deductions || 0);
    const dbAllowances = Number(payroll.allowances || 0);
    const dbNetSalary = Number(payroll.netSalary || 0);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: any[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const extractVal = (id: string, fallback: any) => {
      if (!payroll.customPayslipHtml) return fallback;
      let val = fallback;
      const regex1 = new RegExp(`<input[^>]*id\\s*=\\s*["']${id}["'][^>]*value\\s*=\\s*["']([^"']*)["']`, 'i');
      const match1 = payroll.customPayslipHtml.match(regex1);
      if (match1) val = match1[1];
      else {
        const regex2 = new RegExp(`<input[^>]*value\\s*=\\s*["']([^"']*)["'][^>]*id\\s*=\\s*["']${id}["']`, 'i');
        const match2 = payroll.customPayslipHtml.match(regex2);
        if (match2) val = match2[1];
        else {
          const regex3 = new RegExp(`<textarea[^>]*id\\s*=\\s*["']${id}["'][^>]*>([\\s\\S]*?)</textarea>`, 'i');
          const match3 = payroll.customPayslipHtml.match(regex3);
          if (match3) val = match3[1];
        }
      }

      if (typeof val === 'string') {
        // Decode basic HTML entities
        return val
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'");
      }
      return val;
    };

    const payMonth = extractVal('payMonth', `${new Date(0, payroll.month - 1).toLocaleString('default', { month: 'long' })} -- ${payroll.year}`);
    const empName = extractVal('empName', user ? `${user.firstName} ${user.lastName}` : 'N/A');
    const empId = extractVal('empId', emp?.employeeCode || 'N/A');
    const designation = extractVal('designation', emp?.designation?.name || 'N/A');
    const department = extractVal('department', emp?.department?.name || 'N/A');
    const payPeriod = extractVal('payPeriod', 'N/A');

    const totalWorkingDays = extractVal('totalWorkingDays', '0');
    const leavesTaken = extractVal('leavesTaken', '0');
    const actualDaysWorked = extractVal('actualDaysWorked', '0');
    const availableCL = extractVal('availableCL', '-');
    const grossSalary = extractVal('grossSalary', dbBasicSalary);
    const allowances = extractVal('allowances', dbAllowances);
    const overtime = extractVal('overtime', '0');
    const deductions = extractVal('deductions', dbDeductions);
    const netPayable = extractVal('netPayable', dbNetSalary);

    const lwp = extractVal('lwp', '0');
    const pf = extractVal('pf', '-');
    const profTax = extractVal('profTax', '-');
    const remark = extractVal('remark', '-');

    // Layout
    let currentY = 40;

    try {
      const logoUrl = 'https://res.cloudinary.com/dxju8ikk4/image/upload/v1781672256/hgbll6bcqc7b8a8hppbi.png';
      const logoResponse = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      doc.image(logoResponse.data, 40, currentY, { height: 60 });
    } catch (e) {
      console.error('Failed to load logo for PDF:', e.message);
    }

    doc.fillColor('#000').fontSize(11).font('Helvetica-Bold')
      .text('CIN:U62091UP2025PTC222420', 300, currentY + 10, { width: 255, align: 'right' });
    doc.font('Helvetica-Bold').text('Email: info@difmo.com', 300, currentY + 25, { width: 255, align: 'right' });
    doc.font('Helvetica-Bold').text('Phone: +91 9519202509', 300, currentY + 40, { width: 255, align: 'right' });

    currentY += 80;

    doc.fillColor('#1155cc').fontSize(16).font('Helvetica-Bold')
      .text('DIFMO PRIVATE LIMITED', 40, currentY, { align: 'center', width: 515 });

    currentY += 30;

    // Helper for table drawing
    const leftX = 40;
    const midX = 280;
    const rightX = 555;

    const drawRow = (y, leftText, rightText, isHeader = false, isSection = false) => {
      let height = isSection ? 25 : 22;

      // Special handling for Remark to allow multi-line wrapping
      if (leftText === 'Remark:') {
        doc.fontSize(11).font('Helvetica');
        const textHeight = doc.heightOfString(String(rightText), { width: rightX - midX - 16 });
        height = Math.max(22, textHeight + 10);
      }

      doc.rect(leftX, y, midX - leftX, height).stroke();
      doc.rect(midX, y, rightX - midX, height).stroke();

      if (isSection) {
        doc.rect(leftX, y, rightX - leftX, height).fill('#d9e2f3');
        doc.rect(leftX, y, rightX - leftX, height).stroke();
      }

      doc.fillColor('#000').fontSize(11).font(isHeader || isSection ? 'Helvetica-Bold' : 'Helvetica');
      let textY = y + (height - 11) / 2;

      // If remark height is expanded, start text near the top rather than middle
      if (leftText === 'Remark:' && height > 22) {
        textY = y + 5;
      }

      if (isSection) {
        doc.text(leftText, leftX, textY, { width: midX - leftX, align: 'center' });
        doc.text(rightText, midX, textY, { width: rightX - midX, align: 'center' });
      } else {
        doc.text(leftText, leftX + 8, leftText === 'Remark:' && height > 22 ? y + 5 : textY);
        if (leftText === 'Remark:') {
          doc.text(String(rightText), midX + 8, textY, { width: rightX - midX - 16 });
        } else if (leftText === 'Employee Name' || leftText === 'Employee ID' || leftText === 'Designation' || leftText === 'Department' || leftText === 'Pay Period') {
          doc.text(String(rightText), midX + 8, textY);
        } else {
          doc.text(String(rightText), midX, textY, { width: rightX - midX - 8, align: 'right' });
        }
      }
      return y + height;
    };

    // Title Row
    doc.rect(leftX, currentY, rightX - leftX, 40).stroke();
    doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Salary Slip', leftX, currentY + 8, { width: rightX - leftX, align: 'center' });
    doc.fontSize(12).font('Helvetica').text('For the month of: ', leftX + 160, currentY + 25);
    doc.font('Helvetica-Bold').text(payMonth, leftX + 260, currentY + 25);
    currentY += 40;

    // Employee Details Section
    currentY = drawRow(currentY, 'Employee Details', 'Details', false, true);
    currentY = drawRow(currentY, 'Employee Name', empName);
    currentY = drawRow(currentY, 'Employee ID', empId);
    currentY = drawRow(currentY, 'Designation', designation);
    currentY = drawRow(currentY, 'Department', department);
    currentY = drawRow(currentY, 'Pay Period', payPeriod);

    // Salary Components
    currentY = drawRow(currentY, 'Salary Components', 'Amount (INR)', false, true);
    currentY = drawRow(currentY, 'Total Working Days', totalWorkingDays);
    currentY = drawRow(currentY, 'Leaves Taken', leavesTaken);
    currentY = drawRow(currentY, 'Actual Days Worked', actualDaysWorked);
    currentY = drawRow(currentY, 'Available CL', availableCL);
    currentY = drawRow(currentY, 'Gross Salary', grossSalary);
    currentY = drawRow(currentY, 'Allowances', allowances);
    currentY = drawRow(currentY, 'Overtime', overtime);
    currentY = drawRow(currentY, 'Deductions', deductions);
    currentY = drawRow(currentY, 'Net Payable Salary', netPayable);

    // Deduction Breakdown
    currentY = drawRow(currentY, 'Deduction Breakdown', 'Amount (INR)', false, true);
    currentY = drawRow(currentY, 'Leave Without Pay (LWP)', lwp);
    currentY = drawRow(currentY, 'Provident Fund', pf);
    currentY = drawRow(currentY, 'Professional Tax', profTax);
    currentY = drawRow(currentY, 'Remark:', remark);

    // Signature Row
    doc.rect(leftX, currentY, rightX - leftX, 70).stroke();
    try {
      const signUrl = 'https://res.cloudinary.com/dxju8ikk4/image/upload/v1781672045/au2u7m48f06cwqliflvw.png';
      const signResponse = await axios.get(signUrl, { responseType: 'arraybuffer' });
      doc.image(signResponse.data, rightX - 160, currentY + 10, { height: 50 });
    } catch (e) {
      console.error('Failed to load sign for PDF:', e.message);
    }
    currentY += 70;

    // Note Row
    doc.rect(leftX, currentY, rightX - leftX, 45).stroke();
    doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text('Note:', leftX + 8, currentY + 8);
    doc.fontSize(10).font('Helvetica-Oblique').text('This is a system generated pay sheet hence signature not required.', leftX + 8, currentY + 22);

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

  async updateExpense(id: string, updateData: Partial<Expense>): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({ where: { id }, relations: ['employee', 'employee.user'] });
    if (!expense) throw new NotFoundException('Expense not found');

    if (updateData.amount !== undefined) {
      updateData.amount = parseFloat(Number(updateData.amount).toFixed(2));
    }

    Object.assign(expense, updateData);
    const saved = await this.expenseRepository.save(expense);

    // Notify (Email + FCM)
    const isCredit = saved.type === 'credit' || saved.type === 'income';
    const typeStr = isCredit ? 'Income' : 'Expense';
    const statusDisplay = saved.status === 'pending' ? 'Requested' : 'Approved';

    const employeeName = expense.employee ? `${expense.employee.user?.firstName || ''} ${expense.employee.user?.lastName || ''}`.trim() : undefined;

    this.notifyFinanceActivity(
      saved.companyId,
      `Financial Entry ${statusDisplay}: ${saved.title}`,
      `The ${typeStr.toLowerCase()} entry "${saved.title}" has been updated to ${statusDisplay.toLowerCase()}. Amount is ${saved.currency} ${saved.amount}.`,
      'both',
      {
        id: saved.id,
        entryType: 'Expense',
        title: saved.title,
        amount: saved.amount,
        currency: saved.currency,
        financeType: saved.type,
        category: saved.category,
        status: saved.status,
        date: saved.date,
        description: saved.description,
        employeeName: employeeName
      }
    );

    return saved;
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

    const [expensesRaw, payrollsRaw] = await Promise.all([
      this.expenseRepository.find({ where }),
      this.payrollRepository.find({ where: { ...where, status: In(['paid', 'sent']) } }),
    ]);

    let expenses = expensesRaw;
    let payrolls = payrollsRaw;

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
    const payroll = await this.payrollRepository.findOne({ where: { id }, relations: ['employee', 'employee.user'] });
    if (!payroll) throw new NotFoundException('Payroll not found');

    if (data.basicSalary !== undefined || data.allowances !== undefined || data.deductions !== undefined) {
      const basic = Number(data.basicSalary !== undefined ? data.basicSalary : payroll.basicSalary);
      const allowances = Number(data.allowances !== undefined ? data.allowances : (payroll.allowances || 0));
      const deductions = Number(data.deductions !== undefined ? data.deductions : (payroll.deductions || 0));
      data.netSalary = basic + allowances - deductions;
    }

    Object.assign(payroll, data);
    const saved = await this.payrollRepository.save(payroll);

    // Notification Logic for Finance Team
    if (data.financeStatus) {
      const statusDisplay = saved.financeStatus === 'pending' ? 'Requested' : 'Approved';
      const empName = saved.employee?.user ? `${saved.employee.user.firstName} ${saved.employee.user.lastName || ''}`.trim() : 'Employee';
      const netSalary = saved.netSalary || 0;

      this.notifyFinanceActivity(
        saved.companyId,
        `Financial Entry ${statusDisplay}: Payroll — ${empName}`,
        `The payroll entry for ${empName} (${saved.month}/${saved.year}) has been updated to ${statusDisplay.toLowerCase()}. Amount is INR ${netSalary}.`,
        'both',
        {
          id: saved.id,
          entryType: 'Payroll',
          title: `Payroll for ${empName}`,
          amount: netSalary,
          currency: 'INR',
          month: saved.month,
          year: saved.year,
          status: saved.financeStatus,
          description: saved.notes,
          employeeName: empName
        }
      );
    }

    return saved;
  }

  async saveCustomHtml(id: string, customPayslipHtml: string, customEmailBodyHtml: string): Promise<Payroll> {
    const payroll = await this.payrollRepository.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll not found');
    payroll.customPayslipHtml = customPayslipHtml;
    payroll.customEmailBodyHtml = customEmailBodyHtml;
    this.syncPayrollValuesFromHtml(payroll, customPayslipHtml);
    return this.payrollRepository.save(payroll);
  }

  private syncPayrollValuesFromHtml(payroll: Payroll, payslipHtml: string) {
    if (!payslipHtml) return;
    const extractInputValue = (html: string, id: string): string | null => {
      const regex1 = new RegExp(`<input[^>]*id\\s*=\\s*["']${id}["'][^>]*value\\s*=\\s*["']([^"']*)["']`, 'i');
      const match1 = html.match(regex1);
      if (match1) return match1[1];

      const regex2 = new RegExp(`<input[^>]*value\\s*=\\s*["']([^"']*)["'][^>]*id\\s*=\\s*["']${id}["']`, 'i');
      const match2 = html.match(regex2);
      if (match2) return match2[1];

      return null;
    };

    const grossSalaryStr = extractInputValue(payslipHtml, 'grossSalary');
    const allowancesStr = extractInputValue(payslipHtml, 'allowances');
    const deductionsStr = extractInputValue(payslipHtml, 'deductions');
    const netPayableStr = extractInputValue(payslipHtml, 'netPayable');

    if (grossSalaryStr !== null) {
      const val = parseFloat(grossSalaryStr);
      if (!isNaN(val)) {
        payroll.basicSalary = val;
      }
    }
    if (allowancesStr !== null) {
      const val = parseFloat(allowancesStr);
      if (!isNaN(val)) {
        payroll.allowances = val;
      }
    }
    if (deductionsStr !== null) {
      const val = parseFloat(deductionsStr);
      if (!isNaN(val)) {
        payroll.deductions = val;
      }
    }
    if (netPayableStr !== null) {
      const val = parseFloat(netPayableStr);
      if (!isNaN(val)) {
        payroll.netSalary = val;
      }
    }
  }

  async deletePayroll(id: string): Promise<{ message: string }> {
    const payroll = await this.payrollRepository.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll not found');
    await this.payrollRepository.remove(payroll);
    return { message: 'Payroll deleted successfully' };
  }

  async sendPayrollEmail(id: string, customHtml?: string, customNotes?: string) {
    const payroll = await this.payrollRepository.findOne({
      where: { id },
      relations: ['employee', 'employee.user']
    });

    if (!payroll) throw new NotFoundException('Payroll not found');
    if (!payroll.employee?.user?.email) throw new Error('Employee email not found');

    if (customNotes !== undefined) {
      payroll.notes = customNotes;
      await this.payrollRepository.save(payroll);
    }

    const netSal = this.parseSalary(payroll.netSalary);

    // Generate PDF for attachment
    const pdfBuffer = await this.generatePayrollSlip(id);

    await this.notificationsService.send({
      title: 'Difmo Pvt Ltd: Salary Slip Generated',
      message: `Your salary slip for ${payroll.month}/${payroll.year} has been generated. Please find the attached payslip for your records.`,
      type: 'email',
      recipientFilter: 'employees',
      recipientIds: [payroll.employee.userId],
      companyId: payroll.companyId,
      attachments: [
        {
          filename: `${(payroll.employee?.user?.firstName || 'Employee').replace(/ /g, '_')}_Salary_slip_${payroll.month}-${payroll.year}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ],
      metadata: {
        type: 'PAYROLL_GENERATED',
        month: payroll.month,
        year: payroll.year,
        netSalary: netSal,
        useCustomHtml: !!customHtml,
        customHtml: customHtml || undefined
      }
    });

    payroll.status = 'sent';
    await this.payrollRepository.save(payroll);

    return { message: 'Email sent successfully with attachment' };
  }
}
