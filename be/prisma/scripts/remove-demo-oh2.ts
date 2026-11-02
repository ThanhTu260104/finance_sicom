import { PrismaClient, ProjectStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const oh2 = await prisma.project.findFirst({
    where: { code: { equals: 'OH2', mode: 'insensitive' } },
  });
  if (!oh2) {
    console.log('OH2 not found — nothing to remove');
    return;
  }

  await prisma.projectOperatingCost.deleteMany({
    where: { projectId: oh2.id },
  });

  await prisma.project.update({
    where: { id: oh2.id },
    data: { deletedAt: new Date(), status: ProjectStatus.CANCELLED },
  });

  console.log('Removed demo OH2:', oh2.id);
}

main().finally(() => prisma.$disconnect());
