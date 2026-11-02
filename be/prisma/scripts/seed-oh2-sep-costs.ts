/**
 * Demo: full operating costs — period 2026-09 (default project UBCS2)
 * Run: npx tsx prisma/scripts/seed-oh2-sep-costs.ts
 */
import { EmployeeStatus, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();
const PERIOD = process.env.COST_PERIOD ?? '2026-09';
const PROJECT_CODE = (process.env.PROJECT_CODE ?? 'UBCS2').trim();

type CostLine = { title: string; amount: number; note?: string };
type LinesMap = Record<string, CostLine[]>;

/** Mẫu theo kỳ — để so sánh hiển thị nhiều tháng trên UI. */
const LINES_BY_PERIOD: Record<string, LinesMap> = {
  '2026-07': {
    PERSONNEL: [
      { title: 'Lương điều phối hiện trường T7', amount: 82_000_000 },
      { title: 'Phụ cấp ca hè', amount: 9_000_000, note: 'Tháng 7' },
    ],
    OPERATING: [
      { title: 'Điện nước site (cao điểm hè)', amount: 21_000_000, note: 'EVN T7' },
      { title: 'Internet + SIM', amount: 4_000_000 },
      { title: 'Xe công trình', amount: 8_500_000 },
    ],
    SOFTWARE_INSURANCE: [
      { title: 'License phần mềm quý 3', amount: 6_500_000 },
      { title: 'Bảo hiểm T7', amount: 20_000_000 },
    ],
    TOOLS_CONSUMABLES: [
      { title: 'PPE + vật tư tiêu hao', amount: 7_200_000 },
      { title: 'Thiết bị đo tạm', amount: 4_800_000 },
    ],
    DOCUMENTATION: [
      { title: 'In hồ sơ tháng 7', amount: 2_900_000 },
      { title: 'Scan lưu trữ', amount: 1_500_000 },
    ],
    SUBCONTRACTOR_TAX: [
      { title: 'NT phụ HVAC', amount: 38_000_000 },
      { title: 'Thuế TNDN tạm T7', amount: 14_000_000 },
    ],
    OTHER: [
      { title: 'Phát sinh T7', amount: 4_000_000 },
      { title: 'Tiếp khách CĐT', amount: 3_100_000 },
    ],
  },
  '2026-09': {
    PERSONNEL: [
      { title: 'Lương điều phối hiện trường T9', amount: 85_000_000 },
      { title: 'Phụ cấp ca / OT cuối tuần', amount: 12_500_000, note: 'Tháng 9' },
    ],
    OPERATING: [
      { title: 'Điện nước văn phòng site', amount: 18_500_000, note: 'HĐ EVN T9' },
      { title: 'Internet + SIM field', amount: 4_200_000 },
      { title: 'Thuê xe đi lại công trình', amount: 9_800_000 },
    ],
    SOFTWARE_INSURANCE: [
      { title: 'Gia hạn phần mềm quản lý dự án', amount: 6_500_000 },
      { title: 'Bảo hiểm công trình tháng 9', amount: 22_000_000 },
    ],
    TOOLS_CONSUMABLES: [
      { title: 'Vật tư tiêu hao PPE', amount: 8_400_000 },
      { title: 'Dụng cụ đo kiểm tạm', amount: 5_600_000 },
    ],
    DOCUMENTATION: [
      { title: 'In ấn hồ sơ nghiệm thu', amount: 3_200_000 },
      { title: 'Lưu trữ + scan hồ sơ', amount: 1_800_000 },
    ],
    SUBCONTRACTOR_TAX: [
      { title: 'Thanh toán NT phụ — điện nhẹ', amount: 45_000_000 },
      { title: 'Tạm ứng thuế TNDN T9', amount: 15_000_000 },
    ],
    OTHER: [
      { title: 'Phát sinh khác (dự phòng T9)', amount: 5_000_000 },
      { title: 'Chi tiêu đón tiếp CĐT', amount: 2_400_000 },
    ],
  },
};

function linesForCategory(
  period: string,
  code: string,
  categoryName: string,
): CostLine[] {
  const map =
    LINES_BY_PERIOD[period] ??
    LINES_BY_PERIOD['2026-09'];
  const key = Object.keys(map).find(
    (k) => k.toUpperCase() === code.toUpperCase(),
  );
  if (key && map[key]) return map[key]!;
  const mm = period.slice(5, 7);
  return [
    {
      title: `${categoryName} — tháng ${mm}`,
      amount: 10_000_000,
      note: 'Mẫu auto',
    },
  ];
}

async function resolveProject(code: string) {
  const project = await prisma.project.findFirst({
    where: {
      deletedAt: null,
      code: { equals: code, mode: 'insensitive' },
    },
  });
  if (!project) {
    throw new Error(
      `Không tìm thấy dự án "${code}" (ACTIVE). Tạo dự án trên web trước khi seed.`,
    );
  }
  return project;
}

async function main() {
  const project = await resolveProject(PROJECT_CODE);

  const categories = await prisma.costCategory.findMany({
    where: { deletedAt: null, status: EmployeeStatus.ACTIVE },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });

  if (categories.length === 0) {
    console.error('Chưa có loại chi phí ACTIVE. Chạy migration/seed cost categories trước.');
    process.exit(1);
  }

  const deleted = await prisma.projectOperatingCost.deleteMany({
    where: { projectId: project.id, period: PERIOD },
  });

  let created = 0;
  for (const cat of categories) {
    const templates = linesForCategory(PERIOD, cat.code, cat.name);

    for (const line of templates) {
      await prisma.projectOperatingCost.create({
        data: {
          projectId: project.id,
          categoryId: cat.id,
          period: PERIOD,
          title: line.title,
          amount: new Decimal(line.amount),
          note: line.note ?? null,
        },
      });
      created += 1;
    }
  }

  const total = await prisma.projectOperatingCost.aggregate({
    where: { projectId: project.id, period: PERIOD },
    _sum: { amount: true },
  });

  console.log(
    JSON.stringify(
      {
        project: { id: project.id, code: project.code, name: project.name },
        period: PERIOD,
        removedPreviousLines: deleted.count,
        createdLines: created,
        totalAmount: total._sum.amount?.toString() ?? '0',
        categoriesUsed: categories.map((c) => c.code),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
