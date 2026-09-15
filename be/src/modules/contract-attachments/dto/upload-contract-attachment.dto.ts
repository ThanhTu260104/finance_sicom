import { ContractAttachmentKind } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadContractAttachmentDto {
  @IsEnum(ContractAttachmentKind)
  kind!: ContractAttachmentKind;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
