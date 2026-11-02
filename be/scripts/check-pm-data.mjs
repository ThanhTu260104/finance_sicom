import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
try {
  const pm = await p.projectAssignment.findMany({
    where: { role: 'PROJECT_MANAGER' },
    include: {
      project: { select: { code: true, name: true, deletedAt: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 40,
  });
  console.log('--- PROJECT_MANAGER (latest 40) ---');
  for (const a of pm) {
    console.log(
      `${a.project?.code ?? '?'} | note="${(a.note ?? '').slice(0, 60)}" | deleted=${a.project?.deletedAt != null}`,
    );
  }
  const total = await p.projectAssignment.count({
    where: { role: 'PROJECT_MANAGER' },
  });
  const withNote = await p.projectAssignment.count({
    where: {
      role: 'PROJECT_MANAGER',
      note: { not: null },
      NOT: { note: '' },
    },
  });
  const activeProjects = await p.project.count({ where: { deletedAt: null } });
  console.log(
    `\nTotals: PM rows=${total}, PM with note=${withNote}, active projects=${activeProjects}`,
  );
} finally {
  await p.$disconnect();
}
