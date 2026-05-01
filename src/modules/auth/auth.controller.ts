import {
  Controller,
  Post,
  Patch,
  Body,
  UseGuards,
  Get,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserService } from '../users/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) { }
  //login endpoint that validates the user's credentials and returns a JWT token if valid. It uses the AuthService to perform the validation and token generation. If the credentials are invalid, it throws an UnauthorizedException.
  @Post('login')
  async login(@Body() req) {
    const startTime = Date.now();
    console.log(`[AuthFlow] Login attempt for: ${req.email}`);

    const user = await this.authService.validateUser(req.email, req.password);
    if (!user) {
      console.warn(`[AuthFlow] Invalid credentials for: ${req.email} (Time: ${Date.now() - startTime}ms)`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const response = await this.authService.login(user);
    console.log(`[AuthFlow] Login SUCCESS for: ${req.email} (Time: ${Date.now() - startTime}ms)`);
    return response;
  }

  @UseGuards(JwtAuthGuard)
  @Post('impersonate')
  async impersonate(@Request() req, @Body('userId') userId: string) {
    const requester = await this.userService.findById(req.user.id);
    if (!requester) {
      throw new UnauthorizedException('User not found');
    }
    const isAdmin = ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(requester.email) ||
      requester.roles?.some(r => ['Admin', 'Super Admin'].includes(r.name));

    if (!isAdmin) {
      throw new UnauthorizedException('Only admins can impersonate');
    }

    return this.authService.impersonate(userId);
  }

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-company')
  async switchCompany(@Request() req, @Body('companyId') companyId: string) {
    return this.authService.switchCompany(req.user.id, companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-workspaces')
  async getMyWorkspaces(@Request() req) {
    return this.authService.getMyWorkspaces(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.userService.findById(req.user.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      phone: user.phone,
      company: user.company,
      companies: user.companies || [],
      department: user.department,
      role: user.roles?.[0]?.name || 'Employee',
      roles: user.roles,
      permissions: user.permissions || [],
    };
  }

  // Update logged-in user profile
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() body: any) {
    // req.user is the full User entity from JwtStrategy
    return this.userService.updateProfile(req.user.id, body);
  }
}
