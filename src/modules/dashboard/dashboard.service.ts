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
    
    let employeesPromise;
    let attendanceTodayPromise;
    let tasksPromise;

    // Always fetch company-wide attendance for the "Present Today" count
    attendanceTodayPromise = this.attendanceService.findAll({
        companyId,
        startDate: today,
        endDate: today,
    });

    if (userId) {
        employeesPromise = this.employeeService.findAll({ companyId });
        tasksPromise = this.projectsService.findAllTasksByCompany(companyId);
    } else {
        employeesPromise = this.employeeService.findAll({ companyId });
        tasksPromise = this.projectsService.findAllTasksByCompany(companyId);
    }

    const [employees, attendanceToday, tasks] = await Promise.all([
        employeesPromise,
        attendanceTodayPromise,
        tasksPromise
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
    let userAttendance = null;
    if (userId) {
        userAttendance = attendanceToday.find(a => a.employee?.userId === userId || a.employeeId === userId);
    }

    return {
      totalEmployees: employees.length,
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

    const tasks = await this.projectsService.findAllTasksByCompany(companyId);

    const attendanceData = await Promise.all(
      last7Days.map(async (date) => {
        const dateStr = date.toISOString().split('T')[0];
        const dailyAttendance = await this.attendanceService.findAll({
          companyId,
          startDate: dateStr,
          endDate: dateStr,
        });
        return {
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          present: dailyAttendance.length,
        };
      }),
    );

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
    // 1. Fetch live records from DB for company-specific activities
    const [employees, allLeaves, tasks, auditLogs] = await Promise.all([
      this.employeeService.findAll({ companyId }),
      this.leavesService.findAll({}),
      this.projectsService.findAllTasksByCompany(companyId),
      this.auditLogService.findAll(),
    ]);

    // Filter leaves for this company
    const companyLeaves = allLeaves.filter(l => l.employee?.companyId === companyId);

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

    // Map Audit Logs
    const auditActivities = auditLogs
      .filter(log => log.user?.company?.id === companyId)
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

    // 💡 Personalization: For admins, show pending. For employees, show their approved ones.
    const pendingLeaves = userId 
        ? await this.leavesService.findAll({ employeeId: undefined, status: 'APPROVED' }) // need filter by userId/employeeId
        : await this.leavesService.findAll({ status: 'PENDING' });

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
        // We'll refine the filter to only this user's leaves once the service supports it properly
        const userLeaves = await this.leavesService.findAll({ status: 'APPROVED' });
        const myLeaves = userLeaves.filter(l => l.employee?.userId === userId);
        
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
