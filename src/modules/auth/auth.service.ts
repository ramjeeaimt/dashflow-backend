import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CompanyService } from '../companies/company.service';
import { UserService } from '../users/user.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private companyService: CompanyService,
    private userService: UserService,
    private jwtService: JwtService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (!user) return null;

    // Check password
    if (await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return { ...result, loginRole: 'employee' };
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
        role: user.roles?.[0]?.name || 'Employee',
        roles: user.roles,
        permissions: this.flattenPermissions(user),
      },
    };
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

      // 2. Create Admin User
      const user = await this.userService.create({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        companyId: company.id,
        isActive: true,
      });

      return { company, user };
    } catch (error) {
      console.error('Registration Error:', error);
      throw error;
    }
  }
}
