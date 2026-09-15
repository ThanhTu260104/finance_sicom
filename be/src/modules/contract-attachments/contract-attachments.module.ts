import { Module } from '@nestjs/common';
import { ContractAttachmentsController } from './contract-attachments.controller';
import { ContractAttachmentsService } from './contract-attachments.service';

@Module({
  controllers: [ContractAttachmentsController],
  providers: [ContractAttachmentsService],
  exports: [ContractAttachmentsService],
})
export class ContractAttachmentsModule {}
