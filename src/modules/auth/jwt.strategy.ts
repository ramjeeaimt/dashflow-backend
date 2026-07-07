import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../users/user.service';
import { User } from '../users/user.entity';

interface CachedUser {
  user: User;
  expiresAt: number;
}

// Resolving the user (6-relation join) on EVERY request dominates API latency.
// A short TTL cache bounds staleness: role/permission changes take at most
// AUTH_USER_CACHE_TTL_MS (default 30s) to propagate to already-issued tokens.
const DEFAULT_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 5_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly userCache = new Map<string, CachedUser>();
  private readonly ttlMs: number;

  constructor(
    configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'defaultSecret',
    });
    this.ttlMs = parseInt(
      configService.get<string>('AUTH_USER_CACHE_TTL_MS') ?? `${DEFAULT_TTL_MS}`,
      10,
    );
  }

  async validate(payload: any) {
    // Key includes companyId so each active-workspace variant is cached separately
    const cacheKey = `${payload.sub}:${payload.companyId ?? ''}`;

    if (this.ttlMs > 0) {
      const cached = this.userCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.user;
      }
    }

    // Fetch full user with roles and permissions for CASL
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      this.userCache.delete(cacheKey);
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

    if (this.ttlMs > 0) {
      if (this.userCache.size >= MAX_CACHE_ENTRIES) {
        this.userCache.clear(); // simple bound; rebuilt within one TTL window
      }
      this.userCache.set(cacheKey, { user, expiresAt: Date.now() + this.ttlMs });
    }

    return user;
  }
}
