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
  ) {}
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

//register endpoint that allows new users to create an account. It accepts user details in the request body and uses the AuthService to create a new user record in the database. The implementation of the registration logic (e.g., hashing passwords, validating input) would be handled within the AuthService.
  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
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
