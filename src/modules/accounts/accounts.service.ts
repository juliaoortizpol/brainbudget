import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from './schemas/account.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { InstitutionsService } from '@/modules/institutions/institutions.service';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    private readonly institutionsService: InstitutionsService,
  ) {}

  async create(
    userId: string,
    createAccountDto: CreateAccountDto,
  ): Promise<Account> {
    const institution =
      await this.resolveInstitutionForCreate(createAccountDto);
    const createdAccount = new this.accountModel({
      ...createAccountDto,
      ...institution,
      userId: new Types.ObjectId(userId),
    });
    return createdAccount.save();
  }

  async findAll(userId: string): Promise<Account[]> {
    return this.accountModel
      .find({
        userId: new Types.ObjectId(userId),
        isDeleted: { $ne: true },
      })
      .exec();
  }

  async findOne(id: string, userId: string): Promise<Account> {
    const account = await this.accountModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        isDeleted: { $ne: true },
      })
      .exec();

    if (!account) {
      throw new NotFoundException(`Account #${id} not found`);
    }
    return account;
  }

  async update(
    id: string,
    userId: string,
    updateAccountDto: UpdateAccountDto,
  ): Promise<Account> {
    const { values, unsetInstitutionId } =
      await this.resolveInstitutionForUpdate(updateAccountDto);
    const existingAccount = await this.accountModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
          isDeleted: { $ne: true },
        },
        {
          $set: values,
          ...(unsetInstitutionId && { $unset: { institutionId: 1 } }),
        },
        { new: true },
      )
      .exec();

    if (!existingAccount) {
      throw new NotFoundException(`Account #${id} not found`);
    }
    return existingAccount;
  }

  async softDelete(id: string, userId: string): Promise<Account> {
    const account = await this.accountModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
        { $set: { isDeleted: true } },
        { new: true },
      )
      .exec();

    if (!account) {
      throw new NotFoundException(`Account #${id} not found`);
    }
    return account;
  }

  async markSynced(
    userId: string,
    accountIds: string[],
    syncedAt: Date = new Date(),
  ): Promise<number> {
    const uniqueAccountIds = [...new Set(accountIds)];
    if (uniqueAccountIds.length === 0) return 0;

    const result = await this.accountModel
      .updateMany(
        {
          _id: {
            $in: uniqueAccountIds.map((id) => new Types.ObjectId(id)),
          },
          userId: new Types.ObjectId(userId),
          isDeleted: { $ne: true },
        },
        { $set: { lastSynced: syncedAt } },
      )
      .exec();

    return result.modifiedCount;
  }

  private async resolveInstitutionForCreate(dto: CreateAccountDto) {
    if (dto.institutionId) {
      const institution = await this.institutionsService.findAvailableOne(
        dto.institutionId,
      );
      return {
        institutionId: new Types.ObjectId(dto.institutionId),
        institution: institution.name,
      };
    }

    const customName = dto.institution?.trim();
    if (!customName) {
      throw new BadRequestException(
        'Provide either institutionId or a custom institution name',
      );
    }
    return { institution: customName };
  }

  private async resolveInstitutionForUpdate(dto: UpdateAccountDto) {
    if (dto.institutionId) {
      const institution = await this.institutionsService.findAvailableOne(
        dto.institutionId,
      );
      return {
        values: {
          ...dto,
          institutionId: new Types.ObjectId(dto.institutionId),
          institution: institution.name,
        },
        unsetInstitutionId: false,
      };
    }

    if (dto.institutionId === null || dto.institution !== undefined) {
      const customName = dto.institution?.trim();
      if (!customName) {
        throw new BadRequestException(
          'A custom institution name is required when institutionId is removed',
        );
      }
      const { institutionId: _, ...values } = dto;
      return {
        values: { ...values, institution: customName },
        unsetInstitutionId: true,
      };
    }

    return { values: dto, unsetInstitutionId: false };
  }
}
