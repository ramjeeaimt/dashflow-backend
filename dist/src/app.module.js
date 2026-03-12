"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./modules/auth/auth.module");
const company_module_1 = require("./modules/companies/company.module");
const user_module_1 = require("./modules/users/user.module");
const department_module_1 = require("./modules/departments/department.module");
const access_control_module_1 = require("./modules/access-control/access-control.module");
const employee_module_1 = require("./modules/employees/employee.module");
const attendance_module_1 = require("./modules/attendance/attendance.module");
const company_entity_1 = require("./modules/companies/company.entity");
const user_entity_1 = require("./modules/users/user.entity");
const department_entity_1 = require("./modules/departments/department.entity");
const role_entity_1 = require("./modules/access-control/role.entity");
const permission_entity_1 = require("./modules/access-control/permission.entity");
const employee_entity_1 = require("./modules/employees/employee.entity");
const attendance_entity_1 = require("./modules/attendance/attendance.entity");
const leaves_module_1 = require("./modules/leaves/leaves.module");
const leave_entity_1 = require("./modules/leaves/leave.entity");
const designation_module_1 = require("./modules/designations/designation.module");
const designation_entity_1 = require("./modules/designations/designation.entity");
const client_entity_1 = require("./modules/projects/entities/client.entity");
const project_entity_1 = require("./modules/projects/entities/project.entity");
const task_entity_1 = require("./modules/projects/entities/task.entity");
const payroll_entity_1 = require("./modules/finance/entities/payroll.entity");
const expense_entity_1 = require("./modules/finance/entities/expense.entity");
const audit_log_entity_1 = require("./modules/audit-logs/audit-log.entity");
const time_entry_entity_1 = require("./modules/time-tracking/time-entry.entity");
const mail_module_1 = require("./modules/mail/mail.module");
const projects_module_1 = require("./modules/projects/projects.module");
const finance_module_1 = require("./modules/finance/finance.module");
const audit_log_module_1 = require("./modules/audit-logs/audit-log.module");
const time_tracking_module_1 = require("./modules/time-tracking/time-tracking.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const notification_entity_1 = require("./modules/notifications/entities/notification.entity");
const fcm_token_entity_1 = require("./modules/notifications/entities/fcm-token.entity");
const dashboard_controller_1 = require("./modules/dashboard/dashboard.controller");
const project_entity_2 = require("./modules/project/project.entity");
const project_module_1 = require("./modules/project/project.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => {
                    const dbUrl = configService.get('DATABASE_URL');
                    console.log('DATABASE_URL:', dbUrl ? dbUrl.replace(/:[^:@]*@/, ':****@') : 'Not Set');
                    const entities = [
                        company_entity_1.Company,
                        user_entity_1.User,
                        department_entity_1.Department,
                        role_entity_1.Role,
                        permission_entity_1.Permission,
                        employee_entity_1.Employee,
                        attendance_entity_1.Attendance,
                        leave_entity_1.Leave,
                        designation_entity_1.Designation,
                        client_entity_1.Client,
                        project_entity_1.Project,
                        task_entity_1.Task,
                        payroll_entity_1.Payroll,
                        expense_entity_1.Expense,
                        audit_log_entity_1.AuditLog,
                        time_entry_entity_1.TimeEntry,
                        project_entity_2.AllProject,
                        notification_entity_1.Notification,
                        fcm_token_entity_1.FcmToken,
                    ];
                    if (dbUrl) {
                        return {
                            type: 'postgres',
                            url: dbUrl,
                            entities,
                            synchronize: true,
                            ssl: {
                                rejectUnauthorized: false,
                            },
                        };
                    }
                    console.log('Using SQLite Database');
                    return {
                        type: 'sqlite',
                        database: 'db.sqlite',
                        entities,
                        synchronize: true,
                    };
                },
                inject: [config_1.ConfigService],
            }),
            auth_module_1.AuthModule,
            company_module_1.CompanyModule,
            user_module_1.UserModule,
            department_module_1.DepartmentModule,
            access_control_module_1.AccessControlModule,
            employee_module_1.EmployeeModule,
            attendance_module_1.AttendanceModule,
            leaves_module_1.LeavesModule,
            designation_module_1.DesignationModule,
            mail_module_1.MailModule,
            projects_module_1.ProjectsModule,
            finance_module_1.FinanceModule,
            audit_log_module_1.AuditLogModule,
            time_tracking_module_1.TimeTrackingModule,
            projects_module_1.ProjectsModule,
            project_module_1.AllProjectModule,
            notifications_module_1.NotificationsModule,
        ],
        controllers: [app_controller_1.AppController, dashboard_controller_1.DashboardController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map