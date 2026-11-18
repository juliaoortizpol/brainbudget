import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import type { SavedReportTransaction } from './budget-period-report.schema';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ClosedPeriodException {
  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  reportId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  budgetId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  transactionId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['late_arrival', 'correction'] })
  kind!: 'late_arrival' | 'correction';

  @Prop({ required: true })
  includedInSnapshot!: boolean;

  @Prop({ required: true })
  inCoverageAfter!: boolean;

  @Prop({ type: MongoSchema.Types.Mixed, default: null })
  before!: SavedReportTransaction | null;

  @Prop({ type: MongoSchema.Types.Mixed, required: true })
  after!: SavedReportTransaction;
}

export const ClosedPeriodExceptionSchema = SchemaFactory.createForClass(
  ClosedPeriodException,
);
ClosedPeriodExceptionSchema.index({ userId: 1, reportId: 1, _id: -1 });
ClosedPeriodExceptionSchema.index({
  userId: 1,
  transactionId: 1,
  _id: -1,
});
