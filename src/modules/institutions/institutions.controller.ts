import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { InstitutionsService } from './institutions.service';

@UseGuards(JwtAuthGuard)
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  findAvailable() {
    return this.institutions.findAvailable();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutions.findAvailableOne(id);
  }
}
