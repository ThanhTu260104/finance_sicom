import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, ContractKind, ContractStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CONTRACT_TYPE_CODES } from '../../../common/contract-type.util';

export class QueryContractDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    enum: [...Object.values(ContractKind), 'ALL'],
    default: ContractKind.INVESTOR,
    description: 'Mặc định chỉ HĐ CĐT; ALL = mọi loại',
  })
  @IsOptional()
  @IsIn([...Object.values(ContractKind), 'ALL'])
  kind?: ContractKind | 'ALL';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ enum: CONTRACT_TYPE_CODES })
  @IsOptional()
  @IsIn([...CONTRACT_TYPE_CODES])
  contractType?: (typeof CONTRACT_TYPE_CODES)[number];

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;
}
