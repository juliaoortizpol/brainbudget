import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClosedPeriodHistoryService } from './closed-period-history.service';
import {
  BudgetPeriodReport,
  BudgetPeriodReportSchema,
} from './schemas/budget-period-report.schema';
import {
  ClosedPeriodException,
  ClosedPeriodExceptionSchema,
} from './schemas/closed-period-exception.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BudgetPeriodReport.name, schema: BudgetPeriodReportSchema },
      { name: ClosedPeriodException.name, schema: ClosedPeriodExceptionSchema },
    ]),
  ],
  providers: [ClosedPeriodHistoryService],
  exports: [ClosedPeriodHistoryService, MongooseModule],
})
export class ClosedPeriodHistoryModule {}
