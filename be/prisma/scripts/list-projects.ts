import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const q = process.argv[2] ?? '';

async function main() {
  const rows = await prisma.project.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
    take: 50,
  });
  console.log(rows);
}

main().finally(() => prisma.$disconnect());
