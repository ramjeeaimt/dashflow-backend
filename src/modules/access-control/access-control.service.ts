import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) { }

  async findAllRoles(companyId?: string) {
    return this.roleRepository.find({
      where: companyId ? { company: { id: companyId } } : {},
      relations: ['permissions', 'company'],
    });
  }

  async findOneRole(id: string) {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions', 'company'],
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(data: any) {
    const { permissionIds, companyId, ...roleData } = data;
    const role = new Role();
    Object.assign(role, roleData);

    if (companyId) {
      role.company = { id: companyId } as any;
    }

    if (permissionIds && permissionIds.length > 0) {
      role.permissions = await this.permissionRepository.find({
        where: { id: In(permissionIds) },
      });
    }

    return this.roleRepository.save(role);
  }

  async updateRole(id: string, data: any) {
    const { permissionIds, ...roleData } = data;
    const role = await this.findOneRole(id);

    Object.assign(role, roleData);

    if (permissionIds) {
      role.permissions = await this.permissionRepository.find({
        where: { id: In(permissionIds) },
      });
    }

    return this.roleRepository.save(role);
  }

  async findAllPermissions() {
    return this.permissionRepository.find();
  }

  async createPermission(data: any) {
    const permission = this.permissionRepository.create(data);
    return this.permissionRepository.save(permission);
  }

  async seedDefaultPermissions() {
    const resources = [
      'user',
      'employee',
      'attendance',
      'leave',
      'role',
      'permission',
      'task',
      'client',
      'project',
      'payroll',
      'time-tracking',
      'monitoring',
      'job',
      'expense',
    ];
    const actions = ['create', 'read', 'update', 'delete', 'manage'];

    for (const resource of resources) {
      for (const action of actions) {
        const existing = await this.permissionRepository.findOne({
          where: { action, resource },
        });
        if (!existing) {
          await this.permissionRepository.save({
            action,
            resource,
            description: `Can ${action} ${resource}`,
          });
        }
      }
    }
    return { message: 'Permissions seeded successfully' };
  }

  async seedDefaultRolesForCompany(companyId: string) {
    const defaultRoles = [
      { name: 'Admin', description: 'Full system access', permissions: 'manage:all' },
      { name: 'Manager', description: 'Department management', permissions: 'manage:employee,manage:attendance,read:payroll' },
      { name: 'Employee', description: 'Standard user access', permissions: 'read:employee,read:attendance' },
    ];

    const allPermissions = await this.permissionRepository.find();

    for (const roleInfo of defaultRoles) {
      const existing = await this.roleRepository.findOne({
        where: { name: roleInfo.name, company: { id: companyId } },
      });

      if (!existing) {
        const role = new Role();
        role.name = roleInfo.name;
        role.description = roleInfo.description;
        role.company = { id: companyId } as any;

        // Assign permissions based on roleInfo (simplification: assign all for Admin, some for others)
        if (roleInfo.name === 'Admin') {
          role.permissions = allPermissions;
        } else if (roleInfo.name === 'Manager') {
          role.permissions = allPermissions.filter(p => 
            ['read', 'update', 'create'].includes(p.action) && 
            ['employee', 'attendance', 'leave', 'task'].includes(p.resource)
          );
        } else {
          role.permissions = allPermissions.filter(p => 
            p.action === 'read' && 
            ['employee', 'attendance', 'leave', 'task'].includes(p.resource)
          );
        }

        await this.roleRepository.save(role);
      }
    }
  }

  async deleteRole(id: string) {
    const role = await this.findOneRole(id);

    // Safeguard: Do not allow deleting the primary Admin role
    if (role.name === 'Admin' || role.name === 'Super Admin') {
      throw new Error('Cannot delete system-protected roles');
    }

    return this.roleRepository.remove(role);
  }
}
