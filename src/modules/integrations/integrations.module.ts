import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { GmailConnection, GmailConnectionSchema } from './schemas/gmail-connection.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GmailConnection.name, schema: GmailConnectionSchema }]),
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
