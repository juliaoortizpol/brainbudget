import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { InstitutionsService } from './institutions.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/institutions')
export class InstitutionsAdminController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Post()
  create(@Body() dto: CreateInstitutionDto) {
    return this.institutions.create(dto);
  }

  @Get()
  findAll() {
    return this.institutions.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutions.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstitutionDto) {
    return this.institutions.update(id, dto);
  }

  @Delete(':id')
  disable(@Param('id') id: string) {
    return this.institutions.disable(id);
  }
}
