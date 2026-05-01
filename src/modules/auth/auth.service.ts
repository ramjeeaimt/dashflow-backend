import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CompanyService } from '../companies/company.service';
import { UserService } from '../users/user.service';
import { AccessControlService } from '../access-control/access-control.service';
import { DesignationService } from '../designations/designation.service';
import { EmployeeService } from '../employees/employee.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private companyService: CompanyService,
    private userService: UserService,
    private jwtService: JwtService,
    private accessControlService: AccessControlService,
    private designationService: DesignationService,
    private employeeService: EmployeeService,
  ) { }

  // ... (validateUser, login, etc. stay same)

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (!user) return null;

    // Check password
    if (await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;

      // Dynamically determine loginRole (Case-insensitive)
      const isSuperAdmin = user.email === 'admin@difmo.com' ||
        user.roles?.some(r => r.name?.toUpperCase() === 'SUPER ADMIN');

      // Explicitly allow Pritam as Admin (Bypass DB link issues)
      const isCompanyAdmin = user.roles?.some(r => r.name?.toUpperCase() === 'ADMIN') ||
        user.email === 'pritam@difmo.com';

      let loginRole = 'employee';
      if (isSuperAdmin) loginRole = 'superadmin';
      else if (isCompanyAdmin) loginRole = 'admin';

      return { ...result, loginRole };
    }

    return null;
  }

  async login(user: any) {
    console.log('[AuthService] Generating login response for:', user.email);
    console.log('[AuthService] User fields:', {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    const payload = {
      username: user.email,
      sub: user.id,
      companyId: user.company?.id,
      roles: user.roles,
      loginRole: user.loginRole,
    };

    console.log(`[AuthService] User: ${user.email}, Roles: ${JSON.stringify(user.roles?.map(r => r.name))}, LoginRole: ${user.loginRole}`);

    return {
      access_token: this.jwtService.sign(payload),
      loginRole: user.loginRole,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        phone: user.phone,
        company: user.company,
        companies: user.companies || [],
        role: user.roles?.[0]?.name || 'Employee',
        roles: user.roles,
        permissions: this.flattenPermissions(user),
      },
    };
  }

  async impersonate(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.login({ ...user, loginRole: 'employee' });
  }

  private flattenPermissions(user: any) {
    const permissions = new Set<string>();
    const result: any[] = [];

    // 1. Collect from roles
    if (user.roles) {
      user.roles.forEach((role: any) => {
        if (role.permissions) {
          role.permissions.forEach((perm: any) => {
            const key = `${perm.action}:${perm.resource}`;
            if (!permissions.has(key)) {
              permissions.add(key);
              result.push({
                action: perm.action,
                resource: perm.resource,
                conditions: perm.conditions,
              });
            }
          });
        }
      });
    }

    // 2. Collect from direct permissions
    if (user.permissions) {
      user.permissions.forEach((perm: any) => {
        const key = `${perm.action}:${perm.resource}`;
        if (!permissions.has(key)) {
          permissions.add(key);
          result.push({
            action: perm.action,
            resource: perm.resource,
            conditions: perm.conditions,
          });
        }
      });
    }

    return result;
  }

  async switchCompany(userId: string, companyId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');

    // Check access: user can switch to their primary company OR any extra company
    const hasPrimary = user.company?.id === companyId;
    const hasExtra = user.companies?.some(c => c.id === companyId);
    if (!hasPrimary && !hasExtra) throw new Error('Access denied to this company');
    const targetCompany = hasPrimary
      ? user.company
      : user.companies.find(c => c.id === companyId);

    const isAdmin = user.roles?.some(r => ['Admin', 'ADMIN', 'Super Admin'].includes(r.name));
    return this.login({ ...user, company: targetCompany, loginRole: isAdmin ? 'admin' : 'employee' });
  }

  async getMyWorkspaces(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');

    console.log(`[AuthService] Fetching workspaces for user: ${user.email}`);
    console.log(`[AuthService] Associated company IDs:`, user.companies?.map(c => c.id));
    const companyIds: string[] = [];
    if (user.company?.id) {
      companyIds.push(user.company.id);
    }
    for (const c of (user.companies || [])) {
      if (!companyIds.includes(c.id)) {
        companyIds.push(c.id);
      }
    }
    if (companyIds.length === 0) {
      return [];
    }

    const companies = await Promise.all(
      companyIds.map(async (id) => {
        console.log(`[AuthService] Fetching details for company ID: ${id}`);
        const company = await this.companyService.findById(id);
        if (!company) {
          console.warn(`[AuthService] Company not found for ID: ${id}`);
          return null;
        }
        console.log(`[AuthService] Found company: ${company.name}, users: ${company.users?.length}`);
        return {
          ...company,
          totalEmployees: company.users?.length || 0,
          totalDepartments: company.departments?.length || 0,
        };
      })
    );

    const filtered = companies.filter(Boolean);
    console.log(`[AuthService] Returning ${filtered.length} workspaces`);

    if (filtered.length === 0) {
      return [{
        id: 'dummy',
        name: 'Sample Company (DEBUG)',
        industry: 'Testing',
        totalEmployees: 0,
        totalDepartments: 0
      }];
    }

    return filtered;
  }

  async register(data: any) {
    console.log('Registering with data:', JSON.stringify(data));
    try {
      // 1. Create Company
      const company = await this.companyService.create({
        name: data.companyName,
        website: data.companyWebsite,
        industry: data.industry,
        size: data.companySize,
        logo: data.logo,
        email: data.companyEmail || data.email,
        address: data.companyAddress,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
        timezone: data.timezone,
        currency: data.currency,
        workingDays: data.workingDays,
        workingHoursStart: data.workingHoursStart,
        workingHoursEnd: data.workingHoursEnd,
        enableTimeTracking: data.enableTimeTracking,
        enableScreenMonitoring: data.enableScreenMonitoring,
        enablePayroll: data.enablePayroll,
      });

      // 1.5 Seed Default Roles for new company
      await this.accessControlService.seedDefaultRolesForCompany(company.id);
      await this.designationService.seedDefaultDesignations(company.id);

      // 2. Handle User association
      let user = await this.userService.findByEmail(data.email);

      if (user) {
        // Link existing user to new company and switch to it
        user.company = company;
        if (!user.companies) user.companies = [];
        // Avoid duplicates in companies list
        if (!user.companies.some(c => c.id === company.id)) {
          user.companies.push(company);
        }
        await this.userService.saveUser(user);
      } else {
        // Create new Admin User
        user = await this.userService.create({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          companyId: company.id,
          isActive: true,
        });
      }

      // 3. Assign ADMIN role to the user for this company
      try {
        const allRoles = await this.accessControlService.findAllRoles(company.id);
        const adminRole = allRoles.find(r => r.name.toUpperCase() === 'ADMIN');
        if (adminRole) {
          if (!user.roles) user.roles = [];
          if (!user.roles.some(r => r.id === adminRole.id)) {
            user.roles.push(adminRole);
            await this.userService.saveUser(user);
            console.log(`[AuthService] Assigned ADMIN role to user ${user.email} for company ${company.name}`);
          }
        }

        // 4. Create Employee record for the founder
        const existingEmployee = await this.employeeService.findByUserId(user.id);
        if (!existingEmployee) {
          console.log(`[AuthService] Creating employee record for founder: ${user.email}`);
          await this.employeeService.create({
            userId: user.id,
            companyId: company.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: 'Admin',
            status: 'active',
            hireDate: new Date().toISOString(),
          });
        }
      } catch (roleError) {
        console.error('[AuthService] Failed to setup founder employee/role:', roleError);
      }

      return { company, user };
    } catch (error) {
      console.error('Registration Error:', error);
      throw error;
    }
  }
}
