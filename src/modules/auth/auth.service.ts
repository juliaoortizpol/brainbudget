import type { LoginUser } from '@/common/types/authenticated-request';
import type { User, UserDocument } from '@/modules/users/schemas/user.schema';
import type { Types } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@/modules/users/users.service';
import { RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { BetaAccessService } from './beta-access.service';

type PublicUser = Omit<User, 'passwordHash'> & { _id: Types.ObjectId };

@Injectable()
export class AuthService {
  // PR Review Note: This service handles the core business logic for authentication.
  // It hashes passwords using bcrypt before saving, and signs JWTs upon successful login.
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private betaAccess: BetaAccessService,
  ) {}

  async validateLocalUser(
    email: string,
    pass: string,
  ): Promise<PublicUser | null> {
    this.betaAccess.assertAllowed(email);
    const user = await this.usersService.findByEmail(email);
    if (
      user &&
      user.passwordHash &&
      (await bcrypt.compare(pass, user.passwordHash))
    ) {
      return this.withoutPassword(user);
    }
    return null;
  }

  login(user: LoginUser) {
    const payload = {
      email: user.email,
      sub: user._id,
      role: user.role || 'user',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  private withoutPassword(user: UserDocument): PublicUser {
    const result = user.toObject<User & { _id: Types.ObjectId }>();
    delete result.passwordHash;
    return result;
  }

  async register(registerDto: RegisterDto) {
    this.betaAccess.assertAllowed(registerDto.email);
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash: hashedPassword,
    });
    return this.withoutPassword(user);
  }
}
