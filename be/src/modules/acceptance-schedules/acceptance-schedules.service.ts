import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAcceptanceScheduleDto } from './dto/acceptance-schedule.dto';
import { UpdateAcceptanceScheduleDto } from './dto/update-acceptance-schedule.dto';

@Injectable()
export class AcceptanceSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureContract(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found`);
  }

  async list(contractId: string) {
    await this.ensureContract(contractId);
    return this.prisma.acceptanceSchedule.findMany({
      where: { contractId, deletedAt: null },
      include: { _count: { select: { acceptances: true } } },
      orderBy: { sequence: 'asc' },
    });
  }

  async create(contractId: string, dto: CreateAcceptanceScheduleDto) {
    await this.ensureContract(contractId);
    const exists = await this.prisma.acceptanceSchedule.findFirst({
      where: { contractId, sequence: dto.sequence, deletedAt: null },
    });
    if (exists) throw new ConflictException(`Acceptance schedule #${dto.sequence} already exists`);
    return this.prisma.acceptanceSchedule.create({
      data: { ...dto, contractId, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
    });
  }

  async update(id: string, dto: UpdateAcceptanceScheduleDto) {
    const current = await this.prisma.acceptanceSchedule.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException(`Acceptance schedule ${id} not found`);
    if (dto.sequence && dto.sequence !== current.sequence) {
      const exists = await this.prisma.acceptanceSchedule.findFirst({
        where: { contractId: current.contractId, sequence: dto.sequence, deletedAt: null, NOT: { id } },
      });
      if (exists) throw new ConflictException(`Acceptance schedule #${dto.sequence} already exists`);
    }
    return this.prisma.acceptanceSchedule.update({
      where: { id },
      data: { ...dto, dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined },
    });
  }

  async remove(id: string) {
    const current = await this.prisma.acceptanceSchedule.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException(`Acceptance schedule ${id} not found`);
    return this.prisma.acceptanceSchedule.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
