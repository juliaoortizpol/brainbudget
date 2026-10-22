import type {
  JwtPayload,
  AuthenticatedUser,
} from '@/common/types/authenticated-request';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BetaAccessService } from '../beta-access.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private betaAccess: BetaAccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'super-secret-jwt-key',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    this.betaAccess.assertAllowed(payload.email);
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role || 'user',
    };
  }
}
