/**
 * Xóa mềm toàn bộ nghiệm thu + thu tiền tự động NT/{acceptanceId} để import lại.
 *
 *   npx tsx prisma/scripts/clear-acceptances.ts
 *   npx tsx prisma/scripts/clear-acceptances.ts --contract-id=<uuid>
 *   npx tsx prisma/scripts/clear-acceptances.ts --dry-run
 */
import { AcceptanceStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function argValue(flag: string) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const contractId = argValue('--contract-id');

  const acceptanceWhere = {
    deletedAt: null as Date | null,
    ...(contractId ? { contractId } : {}),
  };

  const acceptances = await prisma.acceptance.findMany({
    where: acceptanceWhere,
    select: { id: true, contractId: true, acceptanceNo: true },
  });

  const autoCollections = await prisma.collection.findMany({
    where: {
      deletedAt: null,
      collectionNo: { startsWith: 'NT/' },
      ...(contractId ? { contractId } : {}),
    },
    select: { id: true, collectionNo: true },
  });

  console.log(
    dryRun ? '[dry-run] ' : '',
    `Sẽ xóa mềm ${acceptances.length} nghiệm thu, ${autoCollections.length} dòng thu NT/...`,
  );
  if (contractId) console.log('  Lọc contractId:', contractId);

  if (dryRun) return;

  const now = new Date();

  if (acceptances.length > 0) {
    await prisma.acceptance.updateMany({
      where: acceptanceWhere,
      data: {
        deletedAt: now,
        status: AcceptanceStatus.CANCELLED,
      },
    });
  }

  if (autoCollections.length > 0) {
    await prisma.collection.updateMany({
      where: {
        id: { in: autoCollections.map((c) => c.id) },
      },
      data: { deletedAt: now },
    });
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
