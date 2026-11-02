import { PrismaClient, ProjectAssignmentRole } from '@prisma/client';

/** Gọi logic giống bulk import — kiểm tra ghi trưởng dự án */
const p = new PrismaClient();

async function upsertPm(projectId, name) {
  const n = name?.trim();
  if (!n) return;
  const existing = await p.projectAssignment.findUnique({
    where: {
      projectId_role: { projectId, role: ProjectAssignmentRole.PROJECT_MANAGER },
    },
  });
  const data = { quantity: 1, note: n };
  if (existing) {
    await p.projectAssignment.update({ where: { id: existing.id }, data });
  } else {
    await p.projectAssignment.create({
      data: { projectId, role: ProjectAssignmentRole.PROJECT_MANAGER, ...data },
    });
  }
}

try {
  const project = await p.project.findFirst({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });
  if (!project) {
    console.log('No active project');
    process.exit(0);
  }
  await upsertPm(project.id, 'TEST PM (script)');
  const pm = await p.projectAssignment.findUnique({
    where: {
      projectId_role: {
        projectId: project.id,
        role: ProjectAssignmentRole.PROJECT_MANAGER,
      },
    },
  });
  console.log(
    `OK project ${project.code} PM note="${pm?.note ?? ''}" (id ${pm?.id})`,
  );
} finally {
  await p.$disconnect();
}
