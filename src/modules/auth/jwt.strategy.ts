import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../users/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'defaultSecret',
    });
  }

  async validate(payload: any) {
    // Fetch full user with roles and permissions for CASL
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      return null;
    }

    // Preserve the active workspace from the JWT session.
    // This allows the user to switch companies without mutating the database.
    if (payload.companyId && user.company?.id !== payload.companyId) {
      const activeCompany = user.companies?.find(c => c.id === payload.companyId);
      if (activeCompany) {
        // Keep the original primary company in the companies list so it doesn't disappear
        const originalPrimary = user.company;
        user.company = activeCompany;
        if (originalPrimary && !user.companies.some(c => c.id === originalPrimary.id)) {
          user.companies.push(originalPrimary);
        }
      }
    }

    return user;
  }
}
