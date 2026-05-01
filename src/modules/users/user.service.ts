import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './user.entity';
import { Role } from '../access-control/role.entity';
import { Permission } from '../access-control/permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) { }

  // CREATE USER
  async create(
    createUserDto: Partial<CreateUserDto> & { phone?: string; companyId?: string },
  ): Promise<User> {
    if (!createUserDto.password) {
      throw new Error('Password is required');
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const { companyId, ...userData } = createUserDto;

    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      company: companyId ? { id: companyId } : undefined,
      companies: companyId ? [{ id: companyId }] : [],
      isActive: true,
    } as any) as unknown as User;

    await this.userRepository.save(user);

    return user;
  }

  // FIND BY EMAIL
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['company', 'companies', 'roles', 'roles.permissions', 'permissions'],
    });
  }

  // FIND BY ID
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['company', 'companies', 'roles', 'roles.permissions', 'permissions', 'department'],
    });
  }

  // GENERAL UPDATE
  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new Error('User not found');

    Object.assign(user, data);
    return this.userRepository.save(user);
  }

  // SAVE USER (for employee.service calls)
  async saveUser(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  // SAFE PROFILE UPDATE
  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    console.log("aerxtcyvubinim", data);
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    delete data.password;
    delete data.roles;
    delete data.company;

    // Check for email conflicts
    if (data.email && data.email !== user.email) {
      const existing = await this.findByEmail(data.email);
      if (existing) throw new Error('Email already exists');
    }

    Object.assign(user, data);

    return this.userRepository.save(user);
  }

  // FIND ROLES BY IDS
  async findRolesByIds(ids: string[]): Promise<Role[]> {
    return this.roleRepository.find({ where: { id: In(ids) } });
  }

  // FIND PERMISSIONS BY IDS
  async findPermissionsByIds(ids: string[]): Promise<Permission[]> {
    return this.permissionRepository.find({ where: { id: In(ids) } });
  }

  // FIND ROLE BY NAME
  async findRoleByName(name: string): Promise<Role | null> {
    return this.roleRepository.findOne({ where: { name } });
  }

  // ASSIGN ROLE TO USER
  async assignRole(userId: string, roleName: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) throw new Error('User not found');

    let role = await this.roleRepository.findOne({ where: { name: roleName } });

    if (!role) {
      role = this.roleRepository.create({
        name: roleName,
        description: `Default ${roleName} role`,
      });
      await this.roleRepository.save(role);
    }

    const hasRole = user.roles?.some((r) => r.id === role.id);
    if (!hasRole) {
      if (!user.roles) user.roles = [];
      user.roles.push(role);
      await this.userRepository.save(user);
    }

    return user;
  }
}
