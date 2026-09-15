import {
  AcceptancePaymentStatus,
  AcceptanceStatus,
  DocumentStatus,
  type Acceptance,
  type PrismaClient,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { compareDecimals, sumDecimals } from './decimal.util';

export function autoCollectionNo(acceptanceId: string) {
  return `NT/${acceptanceId}`;
}

/**
 * NT chọn Đã thu → tạo/cập nhật thu tiền tự động (bù phần chưa cover).
 * Bỏ Đã thu / chưa nộp HS → xóa thu tiền tự động NT/{id}.
 * Sau đó suy lại paymentStatus từ tổng thu tiền theo kỳ (FIFO).
 */
export async function syncAcceptanceCollectionLink(
  prisma: PrismaClient,
  acceptance: Acceptance,
) {
  const collectionNo = autoCollectionNo(acceptance.id);
  const shouldCollect =
    acceptance.documentStatus === DocumentStatus.SUBMITTED_UNPAID &&
    acceptance.paymentStatus === AcceptancePaymentStatus.COLLECTED;

  if (!shouldCollect) {
    await prisma.collection.updateMany({
      where: {
        contractId: acceptance.contractId,
        collectionNo,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  } else {
    const shortfall = await computeAutoCollectionShortfall(prisma, acceptance);
    const existing = await prisma.collection.findFirst({
      where: {
        contractId: acceptance.contractId,
        collectionNo,
      },
    });

    if (compareDecimals(shortfall, 0) <= 0) {
      if (existing && !existing.deletedAt) {
        await prisma.collection.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        });
      }
    } else {
      const payload = {
        period: acceptance.period,
        amount: shortfall,
        collectionDate:
          acceptance.acceptanceDate ?? existing?.collectionDate ?? new Date(),
        note: `Tự đồng bộ từ nghiệm thu ${acceptance.acceptanceNo}`,
        deletedAt: null as Date | null,
      };

      if (existing) {
        await prisma.collection.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await prisma.collection.create({
          data: {
            contractId: acceptance.contractId,
            collectionNo,
            period: payload.period,
            amount: payload.amount,
            collectionDate: payload.collectionDate,
            note: payload.note,
          },
        });
      }
    }
  }

  await deriveAcceptancePaymentStatuses(prisma, acceptance.contractId);
}

async function computeAutoCollectionShortfall(
  prisma: PrismaClient,
  acceptance: Acceptance,
) {
  const collections = await prisma.collection.findMany({
    where: {
      contractId: acceptance.contractId,
      period: acceptance.period,
      deletedAt: null,
      NOT: { collectionNo: autoCollectionNo(acceptance.id) },
    },
  });
  const acceptances = await prisma.acceptance.findMany({
    where: {
      contractId: acceptance.contractId,
      period: acceptance.period,
      deletedAt: null,
      documentStatus: DocumentStatus.SUBMITTED_UNPAID,
    },
    orderBy: [
      { acceptanceDate: 'asc' },
      { createdAt: 'asc' },
      { acceptanceNo: 'asc' },
    ],
  });

  let remaining = sumDecimals(collections.map((c) => c.amount));
  for (const row of acceptances) {
    const amount = new Decimal(row.amount);
    if (row.id === acceptance.id) {
      const covered = Decimal.min(amount, remaining);
      return amount.sub(covered);
    }
    if (compareDecimals(remaining, amount) >= 0) {
      remaining = remaining.sub(amount);
    } else {
      remaining = new Decimal(0);
    }
  }
  return new Decimal(acceptance.amount);
}

/**
 * Suy paymentStatus từ thu tiền thực tế theo kỳ (FIFO trong từng kỳ).
 */
export async function deriveAcceptancePaymentStatuses(
  prisma: PrismaClient,
  contractId: string,
) {
  const [acceptances, collections] = await Promise.all([
    prisma.acceptance.findMany({
      where: { contractId, deletedAt: null },
      orderBy: [
        { period: 'asc' },
        { acceptanceDate: 'asc' },
        { createdAt: 'asc' },
        { acceptanceNo: 'asc' },
      ],
    }),
    prisma.collection.findMany({
      where: { contractId, deletedAt: null },
    }),
  ]);

  const collectedByPeriod = new Map<string, Decimal>();
  for (const row of collections) {
    const prev = collectedByPeriod.get(row.period) ?? new Decimal(0);
    collectedByPeriod.set(row.period, prev.add(row.amount));
  }

  const remainingByPeriod = new Map(collectedByPeriod);

  for (const row of acceptances) {
    if (row.documentStatus === DocumentStatus.NOT_SUBMITTED) {
      if (
        row.paymentStatus !== AcceptancePaymentStatus.NOT_ACCEPTED ||
        row.status !== AcceptanceStatus.DRAFT
      ) {
        await prisma.acceptance.update({
          where: { id: row.id },
          data: {
            paymentStatus: AcceptancePaymentStatus.NOT_ACCEPTED,
            status: AcceptanceStatus.DRAFT,
          },
        });
      }
      continue;
    }

    let remaining = remainingByPeriod.get(row.period) ?? new Decimal(0);
    const amount = new Decimal(row.amount);
    const collected =
      compareDecimals(remaining, amount) >= 0
        ? AcceptancePaymentStatus.COLLECTED
        : AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT;

    if (collected === AcceptancePaymentStatus.COLLECTED) {
      remaining = remaining.sub(amount);
    } else {
      remaining = new Decimal(0);
    }
    remainingByPeriod.set(row.period, remaining);

    if (
      row.paymentStatus !== collected ||
      row.status === AcceptanceStatus.DRAFT
    ) {
      await prisma.acceptance.update({
        where: { id: row.id },
        data: {
          paymentStatus: collected,
          status: AcceptanceStatus.APPROVED,
        },
      });
    }
  }
}

export async function removeAutoCollectionForAcceptance(
  prisma: PrismaClient,
  acceptance: Acceptance,
) {
  await prisma.collection.updateMany({
    where: {
      contractId: acceptance.contractId,
      collectionNo: autoCollectionNo(acceptance.id),
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });
  await deriveAcceptancePaymentStatuses(prisma, acceptance.contractId);
}
