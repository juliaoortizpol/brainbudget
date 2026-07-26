import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@/modules/users/users.service';
import { RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { BetaAccessService } from './beta-access.service';

@Injectable()
export class AuthService {
  // PR Review Note: This service handles the core business logic for authentication.
  // It hashes passwords using bcrypt before saving, and signs JWTs upon successful login.
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private betaAccess: BetaAccessService,
  ) {}

  async validateLocalUser(email: string, pass: string): Promise<any> {
    this.betaAccess.assertAllowed(email);
    const user = await this.usersService.findByEmail(email);
    if (
      user &&
      user.passwordHash &&
      (await bcrypt.compare(pass, user.passwordHash))
    ) {
      const { passwordHash, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user._id,
      role: user.role || 'user',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(registerDto: RegisterDto) {
    this.betaAccess.assertAllowed(registerDto.email);
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash: hashedPassword,
    });
    const { passwordHash, ...result } = user.toObject();
    return result;
  }
}
