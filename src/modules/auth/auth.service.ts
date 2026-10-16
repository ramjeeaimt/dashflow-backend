import { Injectable, BadRequestException } from '@nestjs/common';
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
      roles: user.roles?.map(r => ({ id: r.id, name: r.name })),
      loginRole: user.loginRole,
    };

    console.log(`[AuthService] User: ${user.email}, Roles: ${JSON.stringify(user.roles?.map(r => r.name))}, LoginRole: ${user.loginRole}`);

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '365d' }),
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

  // Change own password (admin or any logged-in user)
  async changeOwnPassword(userId: string, newPassword: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await this.userService.saveUser(user);
    return { message: 'Password updated successfully' };
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

  async checkEmailAvailable(email: string) {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) {
      return { available: false, exists: true, message: 'Email is required' };
    }

    const [existingUser, existingCompany] = await Promise.all([
      this.userService.findByEmail(normalized),
      this.companyService.findByEmail(normalized),
    ]);

    if (existingUser || existingCompany) {
      return {
        available: false,
        exists: true,
        message: 'This email is already registered. Use a different email or log in.',
      };
    }

    return { available: true, exists: false };
  }

  /** Step 1 — create admin account first (no company yet). */
  async registerAccount(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    const email = (data.email || '').trim().toLowerCase();
    if (!email || !data.password || !data.firstName?.trim() || !data.lastName?.trim()) {
      throw new BadRequestException('Name, email, and password are required.');
    }

    const emailCheck = await this.checkEmailAvailable(email);
    if (!emailCheck.available) {
      throw new BadRequestException(emailCheck.message);
    }

    const user = await this.userService.create({
      email,
      password: data.password,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone || undefined,
      isActive: true,
    });

    const fresh = await this.userService.findById(user.id);
    return this.login({ ...fresh, loginRole: 'admin' });
  }

  /** Step 2 — create company and attach the logged-in admin. */
  async registerCompany(userId: string, data: any) {
    const user = await this.userService.findById(userId);
    if (!user) throw new BadRequestException('Account not found. Create your account first.');

    if (user.company?.id) {
      // Already has a company — treat as update
      return this.updateRegistrationCompany(userId, data);
    }

    if (!data.companyName?.trim()) {
      throw new BadRequestException('Company name is required.');
    }

    const companyEmail = (data.companyEmail || user.email || '').trim().toLowerCase();
    const existingCompany = await this.companyService.findByEmail(companyEmail);
    if (existingCompany) {
      throw new BadRequestException(`Company with email ${companyEmail} is already registered.`);
    }

    const company = await this.companyService.create({
      name: data.companyName,
      website: data.companyWebsite,
      industry: data.industry,
      size: data.companySize,
      logo: data.logo,
      email: companyEmail,
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

    await this.accessControlService.seedDefaultRolesForCompany(company.id);
    await this.designationService.seedDefaultDesignations(company.id);

    user.company = company;
    if (!user.companies) user.companies = [];
    if (!user.companies.some((c) => c.id === company.id)) {
      user.companies.push(company);
    }

    try {
      const allRoles = await this.accessControlService.findAllRoles(company.id);
      const adminRole = allRoles.find((r) => r.name.toUpperCase() === 'ADMIN');
      if (adminRole) {
        if (!user.roles) user.roles = [];
        if (!user.roles.some((r) => r.id === adminRole.id)) {
          user.roles.push(adminRole);
        }
      }
    } catch (roleError) {
      console.error('[AuthService] Failed to assign ADMIN role:', roleError);
    }

    await this.userService.saveUser(user);
    const fresh = await this.userService.findById(user.id);
    return {
      company,
      ...(await this.login({ ...fresh, loginRole: 'admin' })),
    };
  }

  /** Later steps — patch company fields as the wizard continues. */
  async updateRegistrationCompany(userId: string, data: any) {
    const user = await this.userService.findById(userId);
    if (!user?.company?.id) {
      throw new BadRequestException('Create your company first.');
    }

    const patch: Record<string, any> = {};
    const map: Record<string, string> = {
      companyName: 'name',
      companyWebsite: 'website',
      industry: 'industry',
      companySize: 'size',
      logo: 'logo',
      companyAddress: 'address',
      city: 'city',
      postalCode: 'postalCode',
      country: 'country',
      timezone: 'timezone',
      currency: 'currency',
      workingDays: 'workingDays',
      workingHoursStart: 'workingHoursStart',
      workingHoursEnd: 'workingHoursEnd',
      enableTimeTracking: 'enableTimeTracking',
      enableScreenMonitoring: 'enableScreenMonitoring',
      enablePayroll: 'enablePayroll',
    };

    Object.entries(map).forEach(([from, to]) => {
      if (data[from] !== undefined && data[from] !== null && data[from] !== '') {
        patch[to] = data[from];
      }
    });

    if (Object.keys(patch).length === 0) {
      return { company: user.company, message: 'Nothing to update' };
    }

    const company = await this.companyService.update(user.company.id, patch);
    return { company, message: 'Saved' };
  }

  /** Full one-shot register (kept for compatibility). Prefer step APIs. */
  async register(data: any) {
    console.log('Registering with data:', JSON.stringify(data));
    try {
      const account = await this.registerAccount({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      });

      const userId = account.user?.id;
      if (!userId) throw new BadRequestException('Account creation failed.');

      return this.registerCompany(userId, data);
    } catch (error) {
      console.error('Registration Error:', error);
      throw error;
    }
  }
}
