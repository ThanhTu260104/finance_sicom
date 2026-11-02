import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { code: { equals: 'UBCS2', mode: 'insensitive' }, deletedAt: null },
  });
  if (!project) {
    console.log('NO_PROJECT');
    return;
  }
  const count = await prisma.projectOperatingCost.count({
    where: { projectId: project.id, period: '2026-09' },
  });
  const sum = await prisma.projectOperatingCost.aggregate({
    where: { projectId: project.id, period: '2026-09' },
    _sum: { amount: true },
  });
  console.log(
    JSON.stringify({
      projectId: project.id,
      code: project.code,
      lines: count,
      total: sum._sum.amount?.toString(),
    }),
  );
}

main().finally(() => prisma.$disconnect());
