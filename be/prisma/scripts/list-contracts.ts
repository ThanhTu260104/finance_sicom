import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const q = process.argv[2] ?? '';

async function main() {
  const rows = await prisma.contract.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { contractNo: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { project: { code: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      contractNo: true,
      name: true,
      project: { select: { id: true, code: true, name: true } },
    },
    take: 30,
  });
  console.log(JSON.stringify(rows, null, 2));
}

main().finally(() => prisma.$disconnect());
