import { Injectable } from '@nestjs/common';
import { EmployeeService } from '../employees/employee.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ProjectsService } from '../projects/projects.service';
import { LeavesService } from '../leaves/leaves.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { FinanceService } from '../finance/finance.service';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly attendanceService: AttendanceService,
    private readonly projectsService: ProjectsService,
    private readonly leavesService: LeavesService,
    private readonly auditLogService: AuditLogService,
    private readonly financeService: FinanceService,
  ) {}

  async getMetrics(companyId: string, userId?: string) {
    if (!companyId) {
      console.warn('[DashboardService] getMetrics called without companyId');
      return { totalEmployees: 0, presentToday: 0, tasksCompleted: 0, avgProductivity: 0 };
    }

    console.log(`[DashboardService] Fetching metrics for company: ${companyId}, user: ${userId || 'all'}`);
    
    // Use IST today string to match attendance date logic
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    const [totalEmployees, attendanceToday, tasks] = await Promise.all([
        // COUNT instead of hydrating every employee row — only the total is used
        this.employeeService.countByCompany(companyId),
        // Company-wide attendance for the "Present Today" count
        this.attendanceService.findAll({
            companyId,
            startDate: today,
            endDate: today,
        }),
        this.projectsService.findAllTasksByCompany(companyId),
    ]);

    let displayTasks = tasks;
    if (userId) {
        displayTasks = tasks.filter((t: any) => t.assigneeId === userId || t.createdById === userId);
    }

    const completedTasks = displayTasks.filter((t: any) => t.status?.toLowerCase() === 'completed').length;
    const totalTasks = displayTasks.length;
    const productivityScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const attendanceBreakdown = {
      early: attendanceToday.filter(a => a.status === 'early_checkin').length,
      late: attendanceToday.filter(a => a.status === 'late').length,
      onTime: attendanceToday.filter(a => ['present', 'half-day', 'early_departure'].includes(a.status)).length,
    };

    // Calculate individual status if userId is provided
    let userAttendance: { status?: string } | null = null;
    if (userId) {
        userAttendance = attendanceToday.find(a => a.employee?.userId === userId || a.employeeId === userId) ?? null;
    }

    return {
      totalEmployees,
      presentToday: attendanceToday.length,
      attendanceBreakdown,
      userStatus: userAttendance ? (userAttendance as any).status : 'absent',
      tasksCompleted: completedTasks,
      avgProductivity: productivityScore, 
    };
  }

  async getChartData(companyId: string) {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return d;
    }).reverse();

    const rangeStart = last7Days[0].toISOString().split('T')[0];
    const rangeEnd = last7Days[last7Days.length - 1].toISOString().split('T')[0];

    // One grouped COUNT query for the whole week instead of 7 full-join loads
    const [tasks, presentByDate] = await Promise.all([
      this.projectsService.findAllTasksByCompany(companyId),
      this.attendanceService.countByDate(companyId, rangeStart, rangeEnd),
    ]);

    const attendanceData = last7Days.map((date) => {
      const dateStr = date.toISOString().split('T')[0];
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        present: presentByDate[dateStr] || 0,
      };
    });

    const productivityData = last7Days.map((date) => {
      const dateStr = date.toISOString().split('T')[0];
      const completedOnDay = tasks.filter((t: any) => 
        t.status === 'completed' && 
        new Date(t.updatedAt).toISOString().split('T')[0] === dateStr
      ).length;
      
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: 60 + (completedOnDay * 10) > 100 ? 100 : 60 + (completedOnDay * 10),
      };
    });

    return {
      attendance: attendanceData,
      productivity: productivityData,
    };
  }

  async getFeedData(companyId: string, userId?: string) {
    // 1. Fetch live records from DB for company-specific activities.
    // Leaves and audit logs are scoped to the company IN SQL — previously every
    // company's rows were loaded and filtered in JS (and the audit filter never
    // matched because user.company wasn't loaded).
    const [employees, companyLeaves, tasks, auditLogs] = await Promise.all([
      this.employeeService.findAll({ companyId }),
      this.leavesService.findAll({ companyId }),
      this.projectsService.findAllTasksByCompany(companyId),
      this.auditLogService.findRecentForCompany(companyId, 50),
    ]);

    // Map Employees
    const employeeActivities = employees.map(emp => {
      let roleDisplay = emp.role || 'Employee';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleDisplay);
      if (isUuid) {
        roleDisplay = 'Employee';
      }
      return {
        id: `emp-${emp.id}`,
        type: 'info',
        message: `${emp.user?.firstName || 'New user'} ${emp.user?.lastName || ''} was added to the system as ${roleDisplay}`,
        createdAt: new Date(emp.createdAt || emp.hireDate || new Date()),
      };
    });

    // Map Leaves
    const leaveActivities = companyLeaves.map(leave => ({
      id: `leave-${leave.id}`,
      type: 'leave',
      message: `${leave.employee?.user?.firstName || 'Employee'} ${leave.employee?.user?.lastName || ''} requested a ${leave.type || 'Leave'} leave (${leave.status})`,
      createdAt: new Date(leave.createdAt || new Date()),
    }));

    // Map Tasks
    const taskActivities = tasks.map(task => ({
      id: `task-${task.id}`,
      type: 'task',
      message: `Task "${task.title}" was ${task.status?.toLowerCase() === 'completed' ? 'completed' : 'created'}`,
      createdAt: new Date(task.createdAt || new Date()),
    }));

    // Map Audit Logs (already company-scoped in SQL)
    const auditActivities = auditLogs
      .map(log => ({
        id: `audit-${log.id}`,
        type: log.action.toLowerCase().includes('task') ? 'task' : 
              log.action.toLowerCase().includes('leave') ? 'leave' : 'info',
        message: `${log.user?.firstName || 'User'} ${log.user?.lastName || ''}: ${log.action}`,
        createdAt: new Date(log.createdAt),
      }));

    // Merge and sort
    const combined = [
      ...employeeActivities,
      ...leaveActivities,
      ...taskActivities,
      ...auditActivities,
    ];

    combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const recentActivity = combined.slice(0, 10).map(act => ({
      id: act.id,
      type: act.type,
      message: act.message,
      time: this.getRelativeTime(act.createdAt),
    }));

    // 💡 Personalization: pending approvals are only rendered for admins, so the
    // query is skipped entirely for the employee view (its result was unused).
    const pendingLeaves = userId
        ? []
        : await this.leavesService.findAll({ status: 'PENDING', companyId });

    const upcomingEvents = tasks
      .filter((t: any) => {
          const isRelevant = userId ? (t.assigneeId === userId) : true;
          return isRelevant && t.status !== 'completed' && t.deadline;
      })
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        title: t.title,
        date: new Date(t.deadline).toLocaleDateString(),
        time: 'Due Date',
        type: 'deadline',
        description: t.description || 'Task deadline approaching',
      }));

    // Add approved leaves to upcoming events if it's for an employee
    if (userId) {
        // employeeId filter resolves to employee.userId in the leaves query —
        // same predicate the old JS filter applied, now done in SQL
        const myLeaves = await this.leavesService.findAll({ status: 'APPROVED', employeeId: userId });

        myLeaves.forEach(l => {
            upcomingEvents.push({
                id: l.id,
                title: `Leave: ${l.type}`,
                date: `${l.startDate} to ${l.endDate}`,
                time: 'Approved',
                type: 'leave',
                description: `Your ${l.type} leave has been approved.`
            });
        });
    }

    return {
      recentActivity,
      pendingApprovals: userId ? [] : pendingLeaves.slice(0, 5).map(l => ({
        id: l.id,
        title: `Leave: ${l.type}`,
        subtitle: `From: ${l.employee?.user?.firstName || 'Employee'} ${l.employee?.user?.lastName || ''}`,
        status: 'pending'
      })),
      upcomingEvents,
    };
  }

  async getFinancials(companyId: string) {
    const summary = await this.financeService.getFinancialSummary(companyId);
    return {
      totalPayroll: Math.round(summary.totalPayroll),
      totalExpenses: Math.round(summary.totalExpenses),
      turnover: Math.round(summary.turnover),
      netProfit: Math.round(summary.turnover - summary.grandTotalOutgoing),
      currency: summary.currency,
      outgoingTotal: Math.round(summary.grandTotalOutgoing),
    };
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  }
}
