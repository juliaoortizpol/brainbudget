import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Institution, InstitutionSchema } from './schemas/institution.schema';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsAdminController } from './institutions-admin.controller';
import { AdminGuard } from '@/common/guards/admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
    ]),
  ],
  controllers: [InstitutionsController, InstitutionsAdminController],
  providers: [InstitutionsService, AdminGuard],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
