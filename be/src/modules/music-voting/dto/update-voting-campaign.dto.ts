import { PartialType } from '@nestjs/swagger';
import { CreateVotingCampaignDto } from './create-voting-campaign.dto';

export class UpdateVotingCampaignDto extends PartialType(
  CreateVotingCampaignDto,
) {}
