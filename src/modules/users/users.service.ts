import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(user: Partial<User>): Promise<UserDocument> {
    const existingUser = await this.findByEmail(user.email!);
    if (existingUser) {
      throw new ConflictException('If the email is valid, you will receive further instructions');
    }
    const createdUser = new this.userModel(user);
    return createdUser.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findOrCreateGoogleUser(email: string, googleId: string): Promise<UserDocument> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      if (!existingUser.providers.includes('google')) {
        existingUser.providers.push('google');
        existingUser.googleId = googleId;
        await existingUser.save();
      }
      return existingUser;
    }

    const newUser = new this.userModel({
      email,
      googleId,
      providers: ['google'],
    });
    return newUser.save();
  }
}
