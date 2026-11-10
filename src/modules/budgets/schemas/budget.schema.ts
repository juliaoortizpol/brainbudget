import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '@/modules/users/schemas/user.schema';

export type BudgetDocument = HydratedDocument<Budget>;

@Schema({ timestamps: true })
export class Budget {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: ['monthly', 'weekly', 'custom'] })
  periodType!: string;

  @Prop({ required: true })
  startDate!: Date;

  /** Compatibility alias for plannedEndDate; never a v1 coverage boundary. */
  @Prop()
  endDate?: Date;

  @Prop()
  plannedEndDate?: Date;

  @Prop()
  actualCutoffDate?: Date;

  @Prop()
  closedAt?: Date;

  @Prop()
  timezone?: string;

  @Prop({ enum: [1] })
  coverageVersion?: number;

  @Prop({ required: true, enum: ['draft', 'active', 'closed'] })
  status!: string;

  @Prop({ default: false })
  isDeleted?: boolean;

  @Prop()
  deletedAt?: Date;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);
BudgetSchema.index(
  { userId: 1 },
  {
    name: 'one_active_coverage_v1_per_owner',
    unique: true,
    partialFilterExpression: {
      status: 'active',
      isDeleted: false,
      coverageVersion: 1,
    },
  },
);
