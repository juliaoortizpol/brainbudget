import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { Institution, InstitutionDocument } from './schemas/institution.schema';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  async create(dto: CreateInstitutionDto): Promise<Institution> {
    try {
      return await new this.institutionModel(this.normalize(dto)).save();
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(
          `Institution slug '${dto.slug}' already exists`,
        );
      }
      throw error;
    }
  }

  findAvailable(): Promise<Institution[]> {
    return this.institutionModel
      .find({ enabled: true })
      .sort({ name: 1 })
      .exec();
  }

  findAll(): Promise<Institution[]> {
    return this.institutionModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<Institution> {
    this.assertValidId(id);
    const institution = await this.institutionModel.findById(id).exec();
    if (!institution)
      throw new NotFoundException(`Institution #${id} not found`);
    return institution;
  }

  async findAvailableOne(id: string): Promise<Institution> {
    this.assertValidId(id);
    const institution = await this.institutionModel
      .findOne({ _id: new Types.ObjectId(id), enabled: true })
      .exec();
    if (!institution) {
      throw new NotFoundException(`Institution #${id} not found`);
    }
    return institution;
  }

  async findByIds(ids: string[]): Promise<Institution[]> {
    const objectIds = ids
      .filter(Types.ObjectId.isValid)
      .map((id) => new Types.ObjectId(id));
    return this.institutionModel
      .find({ _id: { $in: objectIds }, enabled: true })
      .exec();
  }

  async update(id: string, dto: UpdateInstitutionDto): Promise<Institution> {
    this.assertValidId(id);
    try {
      const institution = await this.institutionModel
        .findByIdAndUpdate(
          id,
          { $set: this.normalize(dto) },
          { new: true, runValidators: true },
        )
        .exec();
      if (!institution)
        throw new NotFoundException(`Institution #${id} not found`);
      return institution;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(
          `Institution slug '${dto.slug}' already exists`,
        );
      }
      throw error;
    }
  }

  async disable(id: string): Promise<Institution> {
    this.assertValidId(id);
    const institution = await this.institutionModel
      .findByIdAndUpdate(id, { $set: { enabled: false } }, { new: true })
      .exec();
    if (!institution)
      throw new NotFoundException(`Institution #${id} not found`);
    return institution;
  }

  private normalize<T extends CreateInstitutionDto | UpdateInstitutionDto>(
    dto: T,
  ): T {
    return {
      ...dto,
      ...(dto.slug && { slug: dto.slug.trim().toLowerCase() }),
      ...(dto.aliases && { aliases: dto.aliases.map((alias) => alias.trim()) }),
      ...(dto.emailRules && {
        emailRules: dto.emailRules.map((rule) => ({
          ...rule,
          senderAddresses: rule.senderAddresses.map((sender) =>
            sender.trim().toLowerCase(),
          ),
          subjectKeywords:
            rule.subjectKeywords?.map((keyword) => keyword.trim()) || [],
        })),
      }),
    } as T;
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Institution #${id} not found`);
    }
  }
}
