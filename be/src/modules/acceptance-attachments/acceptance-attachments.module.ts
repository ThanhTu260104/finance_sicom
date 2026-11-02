import { Module } from '@nestjs/common';
import { AcceptanceAttachmentsController } from './acceptance-attachments.controller';
import { AcceptanceAttachmentsService } from './acceptance-attachments.service';

@Module({
  controllers: [AcceptanceAttachmentsController],
  providers: [AcceptanceAttachmentsService],
  exports: [AcceptanceAttachmentsService],
})
export class AcceptanceAttachmentsModule {}
