import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Collection } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toDecimalString } from '../../common/utils/decimal.util';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { BulkCollectionDto } from './dto/bulk-collection.dto';
import { deriveAcceptancePaymentStatuses } from '../../common/utils/acceptance-collection.sync';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureContract(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }
    return contract;
  }

  private mapCollection(row: Collection) {
    return {
      ...row,
      amount: toDecimalString(row.amount),
    };
  }

  async findByContract(contractId: string) {
    await this.ensureContract(contractId);
    const rows = await this.prisma.collection.findMany({
      where: { contractId, deletedAt: null },
      orderBy: [{ period: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.mapCollection(row));
  }

  async create(contractId: string, dto: CreateCollectionDto) {
    await this.ensureContract(contractId);

    const existing = await this.prisma.collection.findFirst({
      where: {
        contractId,
        collectionNo: dto.collectionNo,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Collection number "${dto.collectionNo}" already exists on this contract`,
      );
    }

    const created = await this.prisma.collection.create({
      data: {
        contractId,
        collectionNo: dto.collectionNo,
        period: dto.period,
        amount: dto.amount,
        note: dto.note,
        collectionDate: dto.collectionDate
          ? new Date(dto.collectionDate)
          : undefined,
      },
    });

    await deriveAcceptancePaymentStatuses(this.prisma, contractId);
    return this.mapCollection(created);
  }

  async update(id: string, dto: UpdateCollectionDto) {
    const current = await this.prisma.collection.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) {
      throw new NotFoundException(`Collection ${id} not found`);
    }

    if (dto.collectionNo && dto.collectionNo !== current.collectionNo) {
      const existing = await this.prisma.collection.findFirst({
        where: {
          contractId: current.contractId,
          collectionNo: dto.collectionNo,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Collection number "${dto.collectionNo}" already exists on this contract`,
        );
      }
    }

    const updated = await this.prisma.collection.update({
      where: { id },
      data: {
        ...(dto.collectionNo !== undefined
          ? { collectionNo: dto.collectionNo }
          : {}),
        ...(dto.period !== undefined ? { period: dto.period } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.collectionDate !== undefined
          ? {
              collectionDate: dto.collectionDate
                ? new Date(dto.collectionDate)
                : null,
            }
          : {}),
      },
    });

    await deriveAcceptancePaymentStatuses(this.prisma, current.contractId);
    return this.mapCollection(updated);
  }

  async remove(id: string) {
    const current = await this.prisma.collection.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) {
      throw new NotFoundException(`Collection ${id} not found`);
    }

    const deleted = await this.prisma.collection.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await deriveAcceptancePaymentStatuses(this.prisma, current.contractId);
    return this.mapCollection(deleted);
  }

  async bulkUpsert(contractId: string, dto: BulkCollectionDto) {
    await this.ensureContract(contractId);

    if (!dto.items?.length) {
      throw new BadRequestException('No collection items to upsert');
    }

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = item.collectionNo.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate collectionNo in import: "${item.collectionNo}"`,
        );
      }
      seen.add(key);
    }

    const results = [];
    let created = 0;
    let updated = 0;

    for (const item of dto.items) {
      const existing = await this.prisma.collection.findFirst({
        where: {
          contractId,
          collectionNo: item.collectionNo,
          deletedAt: null,
        },
      });

      if (existing) {
        const row = await this.update(existing.id, {
          period: item.period,
          amount: item.amount,
          collectionDate: item.collectionDate,
          note: item.note,
        });
        results.push(row);
        updated += 1;
      } else {
        const row = await this.create(contractId, item);
        results.push(row);
        created += 1;
      }
    }

    // create/update already derive; one final pass keeps bulk consistent
    await deriveAcceptancePaymentStatuses(this.prisma, contractId);
    return { count: results.length, created, updated, data: results };
  }
}
