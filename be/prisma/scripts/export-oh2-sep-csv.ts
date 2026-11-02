/**
 * Export project costs for PERIOD to finance_sicom/samples/*.csv
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const PERIOD = process.env.COST_PERIOD ?? '2026-09';
const PROJECT_CODE = (process.env.PROJECT_CODE ?? 'UBCS2').trim();

function csvEscape(v: string) {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function main() {
  const project = await prisma.project.findFirst({
    where: { code: { equals: PROJECT_CODE, mode: 'insensitive' }, deletedAt: null },
  });
  if (!project) throw new Error(`No project ${PROJECT_CODE}`);

  const rows = await prisma.projectOperatingCost.findMany({
    where: { projectId: project.id, period: PERIOD },
    include: { category: { select: { code: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const lines = [
    'Ky,MaLoai,MoTa,SoTien,GhiChu',
    ...rows.map((r) =>
      [
        r.period,
        r.category.code,
        csvEscape(r.title ?? ''),
        String(r.amount),
        csvEscape(r.note ?? ''),
      ].join(','),
    ),
  ];

  const outDir = path.join(__dirname, '..', '..', '..', 'samples');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `${PROJECT_CODE.toLowerCase()}-chi-phi-${PERIOD}.csv`,
  );
  fs.writeFileSync(outPath, `\uFEFF${lines.join('\n')}`, 'utf8');
  console.log(outPath, rows.length, 'rows');
}

main().finally(() => prisma.$disconnect());
