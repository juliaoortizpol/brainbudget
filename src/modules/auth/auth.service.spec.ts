import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import type { JwtPayload } from '@/common/types/authenticated-request';
import { UserSchema, type User } from '@/modules/users/schemas/user.schema';
import { UsersService } from '@/modules/users/users.service';
import { AuthService } from './auth.service';
import { BetaAccessService } from './beta-access.service';

describe('AuthService typed user boundaries', () => {
  const UserModel = model('AuthLintTestUser', UserSchema);
  const jwt = new JwtService({ secret: 'synthetic-unit-test-secret' });
  const access = new BetaAccessService(
    new ConfigService({ APP_ENV: 'development' }),
  );

  it('omits the password hash from a valid local login without mutating the document', async () => {
    const passwordHash = await bcrypt.hash('synthetic-password', 4);
    const user = new UserModel({ email: 'user@example.test', passwordHash });
    const users = { findByEmail: jest.fn().mockResolvedValue(user) };
    const service = new AuthService(
      users as unknown as UsersService,
      jwt,
      access,
    );

    const result = await service.validateLocalUser(
      user.email,
      'synthetic-password',
    );

    expect(result).toMatchObject({ email: user.email, _id: user._id });
    expect(result).not.toHaveProperty('passwordHash');
    expect(user.passwordHash).toBe(passwordHash);
    await expect(
      service.validateLocalUser(user.email, 'incorrect-password'),
    ).resolves.toBeNull();
  });

  it('returns null when the local user does not exist', async () => {
    const users = { findByEmail: jest.fn().mockResolvedValue(null) };
    const service = new AuthService(
      users as unknown as UsersService,
      jwt,
      access,
    );
    await expect(
      service.validateLocalUser('missing@example.test', 'synthetic'),
    ).resolves.toBeNull();
  });

  it('hashes registration passwords and excludes the hash from the response', async () => {
    const create = jest.fn((values: Partial<User>) =>
      Promise.resolve(new UserModel(values)),
    );
    const service = new AuthService(
      { create } as unknown as UsersService,
      jwt,
      access,
    );
    const result = await service.register({
      email: 'new@example.test',
      password: 'synthetic-password',
    });

    expect(result).not.toHaveProperty('passwordHash');
    const values = create.mock.calls[0][0];
    expect(values.email).toBe('new@example.test');
    expect(
      await bcrypt.compare('synthetic-password', values.passwordHash!),
    ).toBe(true);
  });

  it.each(['user', 'admin'] as const)(
    'preserves the %s role and user identity in JWT claims',
    (role) => {
      const service = new AuthService({} as UsersService, jwt, access);
      const _id = new Types.ObjectId();
      const { access_token } = service.login({
        _id,
        email: 'user@example.test',
        role,
      });
      expect(jwt.verify<JwtPayload>(access_token)).toMatchObject({
        sub: _id.toString(),
        email: 'user@example.test',
        role,
      });
    },
  );
});
