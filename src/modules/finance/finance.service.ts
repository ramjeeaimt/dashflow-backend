import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll } from './entities/payroll.entity';
import { Expense } from './entities/expense.entity';
import { Company } from '../companies/company.entity';
import { Employee } from '../employees/employee.entity';

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

  async findAllPayroll(
    companyId: string,
    month?: number,
    year?: number,
  ): Promise<Payroll[]> {
    const where: any = { companyId };
    if (month) where.month = month;
    if (year) where.year = year;
    return this.payrollRepository.find({
      where,
      relations: ['employee', 'employee.user'],
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
