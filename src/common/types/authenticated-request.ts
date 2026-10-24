import type { Request } from 'express';
import type { Types } from 'mongoose';
import type { User } from '@/modules/users/schemas/user.schema';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: User['role'];
}

export interface JwtPayload {
  sub: string;
  email: string;
  role?: User['role'];
}

export type LoginUser = Pick<User, 'email'> & {
  _id: Types.ObjectId;
  role?: User['role'];
};

export type AuthenticatedRequest<TUser = AuthenticatedUser> = Request & {
  user: TUser;
};
