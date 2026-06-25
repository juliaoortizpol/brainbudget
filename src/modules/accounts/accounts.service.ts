import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from './schemas/account.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
  ) {}

  async create(userId: string, createAccountDto: CreateAccountDto): Promise<Account> {
    const createdAccount = new this.accountModel({
      ...createAccountDto,
      userId: new Types.ObjectId(userId),
    });
    return createdAccount.save();
  }

  async findAll(userId: string): Promise<Account[]> {
    return this.accountModel.find({ 
      userId: new Types.ObjectId(userId),
      isDeleted: { $ne: true }
    }).exec();
  }

  async findOne(id: string, userId: string): Promise<Account> {
    const account = await this.accountModel.findOne({ 
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: { $ne: true }
    }).exec();
    
    if (!account) {
      throw new NotFoundException(`Account #${id} not found`);
    }
    return account;
  }

  async update(id: string, userId: string, updateAccountDto: UpdateAccountDto): Promise<Account> {
    const existingAccount = await this.accountModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), isDeleted: { $ne: true } },
      { $set: updateAccountDto },
      { new: true },
    ).exec();

    if (!existingAccount) {
      throw new NotFoundException(`Account #${id} not found`);
    }
    return existingAccount;
  }

  async softDelete(id: string, userId: string): Promise<Account> {
    const account = await this.accountModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: { isDeleted: true } },
      { new: true },
    ).exec();

    if (!account) {
      throw new NotFoundException(`Account #${id} not found`);
    }
    return account;
  }
}
