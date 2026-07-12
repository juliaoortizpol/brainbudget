import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GmailReaderController } from './gmail-reader.controller';
import { GmailReaderService } from './gmail-reader.service';
import { GmailClientFactory } from './gmail-client.factory';
import {
  GmailReaderConnection,
  GmailReaderConnectionSchema,
} from './schemas/gmail-reader-connection.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GmailReaderConnection.name, schema: GmailReaderConnectionSchema },
    ]),
  ],
  controllers: [GmailReaderController],
  providers: [GmailReaderService, GmailClientFactory],
  exports: [GmailReaderService],
})
export class GmailReaderModule {}
