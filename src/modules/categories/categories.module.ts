import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { ExpenseCategory, ExpenseCategorySchema } from './schemas/expense-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExpenseCategory.name, schema: ExpenseCategorySchema }])
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
