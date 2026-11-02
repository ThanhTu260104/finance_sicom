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

/** Thu tự động gắn với một đợt NT cụ thể (NT/{acceptanceId}). */
export function acceptanceIdFromAutoCollectionNo(
  collectionNo: string,
): string | null {
  const prefix = 'NT/';
  if (!collectionNo.startsWith(prefix)) return null;
  const id = collectionNo.slice(prefix.length).trim();
  return id.length > 0 ? id : null;
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
  /** Chỉ thu tay (không NT/{id}) mới dùng chung FIFO; thu NT đợt khác gắn riêng đợt đó. */
  const manualCollections = collections.filter(
    (c) => !acceptanceIdFromAutoCollectionNo(c.collectionNo),
  );
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

  let remaining = sumDecimals(manualCollections.map((c) => c.amount));
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
 * Suy paymentStatus từ thu tiền thực tế theo kỳ.
 * Thu NT/{id} gắn trực tiếp đợt đó; phần còn lại phân bổ FIFO trong kỳ.
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

  const collectionsByPeriod = new Map<string, typeof collections>();
  for (const row of collections) {
    const list = collectionsByPeriod.get(row.period) ?? [];
    list.push(row);
    collectionsByPeriod.set(row.period, list);
  }

  const acceptancesByPeriod = new Map<string, typeof acceptances>();
  for (const row of acceptances) {
    const list = acceptancesByPeriod.get(row.period) ?? [];
    list.push(row);
    acceptancesByPeriod.set(row.period, list);
  }

  const fifoOrder = (
    a: (typeof acceptances)[number],
    b: (typeof acceptances)[number],
  ) => {
    const ad = a.acceptanceDate?.getTime() ?? 0;
    const bd = b.acceptanceDate?.getTime() ?? 0;
    if (ad !== bd) return ad - bd;
    const ac = a.createdAt.getTime();
    const bc = b.createdAt.getTime();
    if (ac !== bc) return ac - bc;
    return a.acceptanceNo.localeCompare(b.acceptanceNo, 'vi');
  };

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
  }

  for (const [period, periodAcceptances] of acceptancesByPeriod) {
    const periodRows = periodAcceptances.filter(
      (r) => r.documentStatus === DocumentStatus.SUBMITTED_UNPAID,
    );
    if (!periodRows.length) continue;

    const pinned = new Map<string, Decimal>();
    let sharedPool = new Decimal(0);
    for (const c of collectionsByPeriod.get(period) ?? []) {
      const linkedId = acceptanceIdFromAutoCollectionNo(c.collectionNo);
      if (linkedId) {
        const prev = pinned.get(linkedId) ?? new Decimal(0);
        pinned.set(linkedId, prev.add(c.amount));
      } else {
        sharedPool = sharedPool.add(c.amount);
      }
    }

    const sorted = [...periodRows].sort(fifoOrder);

    for (const row of sorted) {
      const amount = new Decimal(row.amount);
      let covered = pinned.get(row.id) ?? new Decimal(0);
      let need = amount.sub(covered);

      if (compareDecimals(need, 0) > 0) {
        const fromPool = Decimal.min(need, sharedPool);
        covered = covered.add(fromPool);
        sharedPool = sharedPool.sub(fromPool);
        need = amount.sub(covered);
      }

      const collected =
        compareDecimals(need, 0) <= 0
          ? AcceptancePaymentStatus.COLLECTED
          : AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT;

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
