import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AcceptanceAttachmentKind } from '@prisma/client';

export class UploadAcceptanceAttachmentDto {
  @IsEnum(AcceptanceAttachmentKind)
  kind!: AcceptanceAttachmentKind;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
