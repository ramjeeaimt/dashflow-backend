import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

import { UserService } from '../users/user.service';

import { MailerService } from '@nestjs-modules/mailer';
import { Company } from '../companies/company.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    private userService: UserService,
    private mailerService: MailerService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
  ) { }

  async create(
    createEmployeeDto: CreateEmployeeDto & { roleIds?: string[]; permissionIds?: string[] },
  ): Promise<Employee> {
    let userId = createEmployeeDto.userId;
    const { roleIds, permissionIds, ...dto } = createEmployeeDto;

    if (!userId && createEmployeeDto.email) {
      const existingUser = await this.userService.findByEmail(
        createEmployeeDto.email,
      );
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const newUser = await this.userService.create({
          email: createEmployeeDto.email,
          password: createEmployeeDto.password || 'welcome123',
          firstName: createEmployeeDto.firstName,
          lastName: createEmployeeDto.lastName,
          phone: createEmployeeDto.phone,
          companyId: createEmployeeDto.companyId,
          avatar: createEmployeeDto.avatar,
          isActive: true,
        });
        userId = newUser.id;
      }
    }

    if (!userId) {
      throw new Error(
        'User ID is required or sufficient details to create a user',
      );
    }

    // Assign Roles
    if (roleIds && roleIds.length > 0) {
      const user = await this.userService.findById(userId);
      if (user) {
        if (roleIds) {
          // ENSURE "Employee" role is always assigned (Real-World RBAC Logic)
          const employeeRole = await this.userService.findRoleByName('Employee');
          const finalRoleIds = [...roleIds];
          if (employeeRole && !finalRoleIds.includes(employeeRole.id)) {
            finalRoleIds.push(employeeRole.id);
          }
          user.roles = await this.userService.findRolesByIds(finalRoleIds);
        }
        if (permissionIds) {
          user.permissions = await this.userService.findPermissionsByIds(permissionIds);
        }
        await this.userService.saveUser(user);
      }
    } else if (permissionIds && permissionIds.length > 0) {
      const user = await this.userService.findById(userId);
      if (user) {
        user.permissions = await this.userService.findPermissionsByIds(permissionIds);
        await this.userService.saveUser(user);
      }
    } else {
      // Default to Employee role if no roles/permissions provided
      await this.userService.assignRole(userId, 'Employee');
    }

    const employee = this.employeeRepository.create({
      ...dto,
      userId,
    });

    // Generate Employee Code
    const count = await this.employeeRepository.count();
    const code = `DIF${(count + 1).toString().padStart(4, '0')}`;
    employee.employeeCode = code;

    const savedEmployee = await this.employeeRepository.save(employee);

    // Send Welcome Email
    try {
      if (createEmployeeDto.email) {
        const company = await this.companyRepository.findOne({
          where: { id: savedEmployee.companyId },
        });

        console.log(`[EmployeeService] Attempting to send welcome email to ${createEmployeeDto.email}`);

        await this.mailerService.sendMail({
          to: createEmployeeDto.email,
          subject: `Welcome to ${company?.name || 'the Team'}!`,
          template: 'welcome',
          context: {
            name: `${createEmployeeDto.firstName} ${createEmployeeDto.lastName}`,
            companyName: company?.name || 'Our Company',
            loginUrl: 'https://difmo-crm-frontend.vercel.app/login',
            year: new Date().getFullYear(),
          },
        }).catch(err => {
          console.error('[EmployeeService] Mailer Error (handled):', err);
        });
      }
    } catch (error) {
      console.error('[EmployeeService] Critical failure in email logic (skipped):', error.message);
    }

    // 🔥 Real-time Notification to Employee
    try {
      await this.notificationsService.send({
        title: 'Welcome to the Team!',
        message: `Hello ${createEmployeeDto.firstName}, you have been added to the system. You can now login to access your dashboard.`,
        type: 'both',
        recipientFilter: 'employees',
        recipientIds: [userId],
        companyId: savedEmployee.companyId,
        metadata: {
          type: 'WELCOME',
          employeeId: savedEmployee.id,
          email: createEmployeeDto.email
        }
      });
    } catch (err) {
      console.error('[EmployeeService] Failed to send welcome notification:', err.message);
    }

    return savedEmployee;
  }

  async findAll(filters?: any): Promise<Employee[]> {
    console.log(
      '[EmployeeService] findAll called with filters:',
      JSON.stringify(filters),
    );

    // const query = this.employeeRepository
    //   .createQueryBuilder('employee')
    //   .leftJoinAndSelect('employee.user', 'user')
    //   .leftJoinAndSelect('user.roles', 'roles')
    //   .leftJoinAndSelect('employee.company', 'company')
    //   .leftJoinAndSelect('employee.department', 'department')
    //   .leftJoinAndSelect('employee.designation', 'designation');

    // ... rest of filters

    const query = this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.isDeleted = :isDeleted', { isDeleted: false })
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('user.permissions', 'permissions')
      .leftJoinAndSelect('roles.permissions', 'rolePermissions')
      .leftJoinAndSelect('employee.company', 'company')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.designation', 'designation');

    if (filters?.companyId) {
      console.log(
        '[EmployeeService] Filtering by companyId:',
        filters.companyId,
      );
      query.andWhere('employee.companyId = :companyId', {
        companyId: filters.companyId,
      });
    }

    if (filters?.userId) {
      console.log('[EmployeeService] Filtering by userId:', filters.userId);
      query.andWhere('employee.userId = :userId', { userId: filters.userId });
    }

    if (filters?.department) {
      console.log(
        '[EmployeeService] Filtering by department:',
        filters.department,
      );
      query.andWhere('employee.departmentId = :departmentId', {
        departmentId: filters.department,
      });
    }

    if (filters?.status) {
      console.log('[EmployeeService] Filtering by status:', filters.status);
      query.andWhere('employee.status = :status', { status: filters.status });
    }

    if (filters?.employmentType) {
      console.log(
        '[EmployeeService] Filtering by employmentType:',
        filters.employmentType,
      );
      query.andWhere('employee.employmentType = :employmentType', {
        employmentType: filters.employmentType,
      });
    }

    if (filters?.branch) {
      console.log('[EmployeeService] Filtering by branch:', filters.branch);
      query.andWhere('employee.branch = :branch', { branch: filters.branch });
    }

    if (filters?.search) {
      console.log('[EmployeeService] Filtering by search:', filters.search);
      query.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search OR employee.role LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const sql = query.getSql();
    const parameters = query.getParameters();
    console.log('[EmployeeService] DIAGNOSTIC - SQL:', sql);
    console.log('[EmployeeService] DIAGNOSTIC - Params:', JSON.stringify(parameters));

    const results = await query.getMany();
    console.log(
      '[EmployeeService] DIAGNOSTIC - Query returned',
      results.length,
      'employees',
    );

    if (results.length === 0 && filters?.userId) {
      console.log(`[EmployeeService] DIAGNOSTIC - ALERT: No employee found for userId: ${filters.userId}`);
      // Check if record exists regardless of filters
      const rawCheck = await this.employeeRepository.findOne({ where: { userId: filters.userId } });
      console.log('[EmployeeService] DIAGNOSTIC - Raw record check (ignoring filters):', rawCheck ? 'FOUND' : 'NOT FOUND');
    }

    return results;
  }

  async findOne(id: string): Promise<Employee | null> {
    return this.employeeRepository.findOne({
      where: { id },
      relations: [
        'user',
        'user.roles',
        'user.roles.permissions',
        'user.permissions',
        'company',
        'department',
        'designation',
      ],
    });
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    return this.employeeRepository.findOne({
      where: { userId },
      relations: ['user', 'company', 'department'],
    });
  }

  async update(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto & {
      roleIds?: string[];
      permissionIds?: string[];
      email?: string;
      phone?: string;
      password?: string;
    },
  ): Promise<Employee | null> {
    console.log('[EmployeeService] Updating employee:', id, updateEmployeeDto);
    try {
      const employee = await this.findOne(id);
      if (!employee) {
        console.log('[EmployeeService] Employee not found:', id);
        return null;
      }

      const firstName = updateEmployeeDto.firstName;
      const lastName = updateEmployeeDto.lastName;
      const email = updateEmployeeDto.email;
      const phone = updateEmployeeDto.phone;
      const password = updateEmployeeDto.password;
      const roleIds = updateEmployeeDto.roleIds;
      const permissionIds = updateEmployeeDto.permissionIds;

      // EXPLICITLY pick only Employee entity fields
      const employeeUpdate: any = {};
      const validFields = [
        'companyId',
        'departmentId',
        'designationId',
        'role',
        'hireDate',
        'salary',
        'manager',
        'branch',
        'employmentType',
        'status',
        'address',
        'emergencyContact',
        'emergencyPhone',
        'skills',
        'avatar',
        'documents',
      ];

      validFields.forEach((field) => {
        if (updateEmployeeDto[field] !== undefined) {
          employeeUpdate[field] = updateEmployeeDto[field];
        }
      });

      if (
        firstName ||
        lastName ||
        email ||
        phone ||
        password ||
        updateEmployeeDto.avatar
      ) {
        if (employee.userId) {
          const userUpdate: any = {};
          if (firstName) userUpdate.firstName = firstName;
          if (lastName) userUpdate.lastName = lastName;
          if (email) userUpdate.email = email;
          if (phone) userUpdate.phone = phone;
          if (password) userUpdate.password = password;
          if (updateEmployeeDto.avatar) {
            userUpdate.avatar = updateEmployeeDto.avatar;
          }

          const user = await this.userService.update(
            employee.userId,
            userUpdate,
          );

          if (roleIds) {
            // ENSURE "Employee" role is always assigned (Real-World RBAC Logic)
            const employeeRole = await this.userService.findRoleByName('Employee');
            const finalRoleIds = [...roleIds];
            if (employeeRole && !finalRoleIds.includes(employeeRole.id)) {
              finalRoleIds.push(employeeRole.id);
            }
            user.roles = await this.userService.findRolesByIds(finalRoleIds);
          }
          if (permissionIds) {
            user.permissions = await this.userService.findPermissionsByIds(
              permissionIds,
            );
          }
          if (roleIds || permissionIds) {
            await this.userService.saveUser(user);

            // Trigger role-assignment notification if roles were changed
            if (roleIds && user.email) {
              const roleNames = user.roles.map(r => r.name);
              console.log(`[EmployeeService] Roles updated for ${user.email}. Sending notification...`);
              await this.mailService.sendRoleAssignmentNotification(user.email, {
                employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                roles: roleNames
              }).catch(err => console.error('[EmployeeService] Role notification failed:', err.message));
            }
          }
        }
      }

      console.log(
        '[EmployeeService] Updating employee record:',
        employeeUpdate,
      );
      await this.employeeRepository.update(id, employeeUpdate);
      return this.findOne(id);
    } catch (error) {
      console.error('[EmployeeService] Update failed:', error);
      throw error;
    }
  }

  // async remove(id: string): Promise<void> {
  //   await this.employeeRepository.delete(id);
  // }

  // async remove(id: string): Promise<void> {
  //   try {
  //     const employee = await this.findOne(id);
  //     if (!employee) throw new Error('Employee not found');
  //      await this.employeeRepository.update(id, { isDeleted: true });

  //     console.log(`[EmployeeService] Employee ${id} soft-deleted`);
  //   } catch (error) {
  //     console.error('[EmployeeService] Failed to delete employee:', error);
  //     throw new Error('Failed to delete employee. Check related user/constraints.');
  //   }
  // }

  // async remove(id: string): Promise<void> {
  // try {
  //   const employee = await this.employeeRepository.findOne({
  //     where: { id, isDeleted: false },
  //   });

  //   if (!employee) throw new Error('Employee not found');

  //   await this.employeeRepository.update(id, { isDeleted: true });
  //   console.log(`[EmployeeService] Employee ${id} soft-deleted`);
  // } catch (error) {
  //   console.error('[EmployeeService] Failed to delete employee:', error);
  //   throw new Error('Failed to delete employee. Check backend logs.');
  // }
  // }

  async remove(id: string): Promise<void> {
    try {
      // Employee ko fetch karo without relations (safe)
      const employee = await this.employeeRepository.findOne({
        where: { id, isDeleted: false },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Soft delete
      await this.employeeRepository.update(id, { isDeleted: true });
      console.log(`[EmployeeService] Employee ${id} soft-deleted`);
    } catch (error) {
      console.error('[EmployeeService] Failed to delete employee:', error);
      throw error; // <-- ye line add karni hai
    }
  }

  async count(companyId?: string): Promise<number> {
    const query = this.employeeRepository.createQueryBuilder('employee');

    if (companyId) {
      query.where('employee.companyId = :companyId', { companyId });
    }

    return query.getCount();
  }

  async fixEmployeeRoles(companyId?: string) {
    console.log('[EmployeeService] Fixing employee roles...');
    const employees = await this.findAll({}); // Get all
    let count = 0;
    let skipped = 0;

    for (const employee of employees) {
      if (employee.userId) {
        try {
          // EVERYONE should have the "Employee" role in a Real-World company
          await this.userService.assignRole(employee.userId, 'Employee');
          count++;
        } catch (e) {
          console.error(
            `[EmployeeService] Failed to assign role to user ${employee.userId}:`,
            e,
          );
        }
      }
    }
    return {
      message: `Fixed roles for ${count} employees. Skipped ${skipped} admins.`,
    };
  }
  async bulkAssignManagers(employeeIds: string[]): Promise<any> {
    const results = { success: 0, failed: 0 };
    const managerRole = await this.userService.findRoleByName('Manager');
    if (!managerRole) throw new Error('Manager role not found in system');

    for (const id of employeeIds) {
      try {
        const employee = await this.findOne(id);
        if (employee && employee.userId) {
          // 1. Assign "Manager" role (Service already handles adding "Employee" via my recent fix)
          const user = await this.userService.findById(employee.userId);
          if (user) {
            const currentRoleIds = user.roles?.map(r => r.id) || [];
            if (!currentRoleIds.includes(managerRole.id)) {
              // Combine roles and update User entity
              const finalRoleIds = [...new Set([...currentRoleIds, managerRole.id])];

              // Use standard update method to handle both Employee string and User relation
              await this.update(id, {
                roleIds: finalRoleIds,
                role: 'Manager'
              });

              console.log(`[EmployeeService] Promoted employee ${id} to Manager role (User synced)`);
              results.success++;
            } else {
              // Even if role exists in User roles, sync the Employee string field just in case
              await this.update(id, { role: 'Manager' });
              results.success++;
            }

          }
        } else {
          console.warn(`[EmployeeService] Skipped employee ${id}: No valid userId found`);
          results.failed++;
        }
      } catch (e) {
        console.error(`[EmployeeService] Failed to assign manager role to ${id}:`, e);
        results.failed++;
      }
    }

    console.log(`[EmployeeService] Bulk Assign Results -> Success: ${results.success}, Failed: ${results.failed}`);
    return results;
  }

  async revokeManagerRole(employeeId: string): Promise<any> {
    const employee = await this.findOne(employeeId);
    if (!employee || !employee.userId) throw new Error('Employee not found');

    const user = await this.userService.findById(employee.userId);
    if (!user) throw new Error('User not found');

    const managerRole = await this.userService.findRoleByName('Manager');
    if (!managerRole) throw new Error('Manager role not found');

    // 1. Remove manager role from User entity
    user.roles = user.roles.filter(r => r.id !== managerRole.id);
    await this.userService.saveUser(user);

    // 2. Sync Employee string field back to "Employee"
    employee.role = 'Employee';
    return this.employeeRepository.save(employee);
  }
}
