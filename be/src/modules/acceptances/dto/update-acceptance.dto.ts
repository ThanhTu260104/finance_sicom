import { PartialType } from '@nestjs/swagger';
import { CreateAcceptanceDto } from './create-acceptance.dto';

export class UpdateAcceptanceDto extends PartialType(CreateAcceptanceDto) {}
