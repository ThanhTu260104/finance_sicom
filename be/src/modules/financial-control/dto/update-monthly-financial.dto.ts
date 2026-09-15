import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateMonthlyFinancialDto } from './create-monthly-financial.dto';

export class UpdateMonthlyFinancialDto extends PartialType(
  OmitType(CreateMonthlyFinancialDto, ['period'] as const),
) {}
