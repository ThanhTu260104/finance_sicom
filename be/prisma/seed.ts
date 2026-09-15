import {
  PrismaClient,
  ProjectStatus,
  ContractType,
  BillingCycle,
  ContractStatus,
  AcceptanceStatus,
  DocumentStatus,
  AcceptancePaymentStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-4000-8000-000000000001';

function distributeAmount(
  total: Decimal,
  periods: string[],
  firstZero: boolean,
) {
  const distributable = firstZero ? periods.slice(1) : periods;
  if (distributable.length === 0) {
    return periods.map((period) => ({ period, amount: new Decimal(0) }));
  }

  const perMonth = total
    .div(distributable.length)
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);
  let allocated = new Decimal(0);
  return periods.map((period, index) => {
    if (firstZero && index === 0) {
      return { period, amount: new Decimal(0) };
    }
    const distributableIndex = firstZero ? index - 1 : index;
    const isLast = distributableIndex === distributable.length - 1;
    const amount = isLast ? total.sub(allocated) : perMonth;
    if (!firstZero || index > 0) {
      allocated = allocated.add(amount);
    }
    return { period, amount };
  });
}

function monthPeriods(start: string, count: number) {
  const [y0, m0] = start.split('-').map(Number);
  const periods: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y0, m0 - 1 + i, 1));
    periods.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
    );
  }
  return periods;
}

async function upsertAcceptance(input: {
  contractId: string;
  acceptanceNo: string;
  period: string;
  amount: Decimal | number;
  acceptanceDate?: Date | null;
  invoiceNo?: string | null;
  invoiceDate?: Date | null;
  status: AcceptanceStatus;
  documentStatus: DocumentStatus;
  paymentStatus: AcceptancePaymentStatus;
  note?: string;
}) {
  const existing = await prisma.acceptance.findFirst({
    where: {
      contractId: input.contractId,
      acceptanceNo: input.acceptanceNo,
    },
  });

  const data = {
    period: input.period,
    amount: input.amount,
    acceptanceDate: input.acceptanceDate ?? null,
    invoiceNo: input.invoiceNo ?? null,
    invoiceDate: input.invoiceDate ?? null,
    status: input.status,
    documentStatus: input.documentStatus,
    paymentStatus: input.paymentStatus,
    note: input.note ?? null,
    deletedAt: null,
  };

  if (existing) {
    await prisma.acceptance.update({ where: { id: existing.id }, data });
  } else {
    await prisma.acceptance.create({
      data: {
        contractId: input.contractId,
        acceptanceNo: input.acceptanceNo,
        ...data,
      },
    });
  }
}

async function upsertCollection(input: {
  contractId: string;
  collectionNo: string;
  period: string;
  amount: number;
  collectionDate: Date;
}) {
  const existing = await prisma.collection.findFirst({
    where: {
      contractId: input.contractId,
      collectionNo: input.collectionNo,
    },
  });

  if (existing) {
    await prisma.collection.update({
      where: { id: existing.id },
      data: {
        period: input.period,
        amount: input.amount,
        collectionDate: input.collectionDate,
        deletedAt: null,
      },
    });
  } else {
    await prisma.collection.create({
      data: {
        contractId: input.contractId,
        collectionNo: input.collectionNo,
        period: input.period,
        amount: input.amount,
        collectionDate: input.collectionDate,
      },
    });
  }
}

async function resetContractFinance(contractId: string) {
  await prisma.acceptance.updateMany({
    where: { contractId, deletedAt: null },
    data: { deletedAt: new Date(), status: AcceptanceStatus.CANCELLED },
  });
  await prisma.collection.updateMany({
    where: { contractId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  await prisma.revenuePlan.deleteMany({ where: { contractId } });
  await prisma.contractMonthlyFinancial.deleteMany({ where: { contractId } });
}

async function seedPlansAndWork(
  contractId: string,
  plan: Array<{ period: string; amount: Decimal }>,
  workThroughIndex: number,
) {
  for (const item of plan) {
    await prisma.revenuePlan.upsert({
      where: {
        contractId_period: { contractId, period: item.period },
      },
      update: { plannedAmount: item.amount },
      create: {
        contractId,
        period: item.period,
        plannedAmount: item.amount,
      },
    });
  }

  for (const item of plan.slice(0, workThroughIndex + 1)) {
    await prisma.contractMonthlyFinancial.upsert({
      where: {
        contractId_period: { contractId, period: item.period },
      },
      update: { actualWorkAmount: item.amount },
      create: {
        contractId,
        period: item.period,
        actualWorkAmount: item.amount,
      },
    });
  }
}

type ScenarioKind =
  | 'ON_TRACK'
  | 'MOSTLY_COLLECTED'
  | 'PENDING_DOCS'
  | 'WAITING_PAYMENT'
  | 'MIXED'
  | 'OVERDUE'
  | 'EARLY_STAGE'
  | 'QUARTERLY';

async function seedScenario(input: {
  contractId: string;
  prefix: string;
  value: string | number;
  startPeriod: string;
  months: number;
  firstZero?: boolean;
  workThroughIndex: number;
  scenario: ScenarioKind;
}) {
  await resetContractFinance(input.contractId);
  const periods = monthPeriods(input.startPeriod, input.months);
  const plan = distributeAmount(
    new Decimal(input.value),
    periods,
    input.firstZero ?? true,
  );
  await seedPlansAndWork(input.contractId, plan, input.workThroughIndex);
  const byPeriod = Object.fromEntries(plan.map((p) => [p.period, p.amount]));
  const active = periods.slice(0, input.workThroughIndex + 1);

  const markCollected = async (period: string, note: string) => {
    const [y, m] = period.split('-').map(Number);
    await upsertAcceptance({
      contractId: input.contractId,
      acceptanceNo: `${input.prefix}-Đợt ${m}/${y}`,
      period,
      amount: byPeriod[period],
      acceptanceDate: new Date(Date.UTC(y, m - 1, 25)),
      invoiceNo: `${input.prefix}-HD-${m}/${y}`,
      invoiceDate: new Date(Date.UTC(y, m - 1, 26)),
      status: AcceptanceStatus.APPROVED,
      documentStatus: DocumentStatus.SUBMITTED_UNPAID,
      paymentStatus: AcceptancePaymentStatus.COLLECTED,
      note,
    });
    await upsertCollection({
      contractId: input.contractId,
      collectionNo: `${input.prefix}-TT-${m}/${y}`,
      period,
      amount: Number(byPeriod[period].toFixed()),
      collectionDate: new Date(Date.UTC(y, m - 1 + 1, 18)),
    });
  };

  const markWaiting = async (
    period: string,
    note: string,
    invoiceOffsetDays = 0,
  ) => {
    const [y, m] = period.split('-').map(Number);
    const invoiceDate = new Date(Date.UTC(y, m - 1, 20));
    invoiceDate.setUTCDate(invoiceDate.getUTCDate() - invoiceOffsetDays);
    await upsertAcceptance({
      contractId: input.contractId,
      acceptanceNo: `${input.prefix}-Đợt ${m}/${y}`,
      period,
      amount: byPeriod[period],
      acceptanceDate: new Date(Date.UTC(y, m - 1, 28)),
      invoiceNo: `${input.prefix}-HD-${m}/${y}`,
      invoiceDate,
      status: AcceptanceStatus.APPROVED,
      documentStatus: DocumentStatus.SUBMITTED_UNPAID,
      paymentStatus: AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT,
      note,
    });
  };

  const markNotAccepted = async (period: string, note: string) => {
    const [y, m] = period.split('-').map(Number);
    await upsertAcceptance({
      contractId: input.contractId,
      acceptanceNo: `${input.prefix}-Đợt ${m}/${y}`,
      period,
      amount: byPeriod[period],
      status: AcceptanceStatus.DRAFT,
      documentStatus: DocumentStatus.NOT_SUBMITTED,
      paymentStatus: AcceptancePaymentStatus.NOT_ACCEPTED,
      note,
    });
  };

  switch (input.scenario) {
    case 'ON_TRACK':
      for (const period of active) {
        await markCollected(period, 'Đúng tiến độ — đã NT và đã thu');
      }
      break;
    case 'MOSTLY_COLLECTED':
      for (const period of active.slice(0, Math.max(active.length - 1, 1))) {
        await markCollected(period, 'Đã thu');
      }
      if (active.length > 1) {
        await markWaiting(active[active.length - 1], 'Mới NT — chờ CĐT thanh toán');
      }
      break;
    case 'PENDING_DOCS':
      for (const period of active.slice(0, Math.floor(active.length / 2))) {
        await markCollected(period, 'Đã thu');
      }
      for (const period of active.slice(Math.floor(active.length / 2))) {
        await markNotAccepted(period, 'Chưa nộp hồ sơ = chưa nghiệm thu');
      }
      break;
    case 'WAITING_PAYMENT':
      for (const period of active.slice(0, 2)) {
        await markCollected(period, 'Đã thu');
      }
      for (const period of active.slice(2)) {
        await markWaiting(period, 'Đã nộp HS — chờ CĐT thanh toán');
      }
      break;
    case 'MIXED': {
      const n = active.length;
      for (const period of active.slice(0, Math.floor(n * 0.4))) {
        await markCollected(period, 'Đã thu');
      }
      for (const period of active.slice(
        Math.floor(n * 0.4),
        Math.floor(n * 0.7),
      )) {
        await markWaiting(period, 'Đã nghiệm thu — chưa thu');
      }
      for (const period of active.slice(Math.floor(n * 0.7))) {
        await markNotAccepted(period, 'Chưa nộp hồ sơ');
      }
      break;
    }
    case 'OVERDUE':
      for (const period of active.slice(0, 2)) {
        await markCollected(period, 'Đã thu');
      }
      for (const period of active.slice(2)) {
        await markWaiting(period, 'Quá hạn thanh toán', 90);
      }
      break;
    case 'EARLY_STAGE':
      for (const period of active.slice(0, 2)) {
        await markCollected(period, 'Giai đoạn đầu — đã thu');
      }
      if (active[2]) {
        await markNotAccepted(active[2], 'Đang chuẩn bị hồ sơ NT');
      }
      break;
    case 'QUARTERLY':
      for (const period of active.slice(0, Math.max(active.length - 1, 0))) {
        await markCollected(period, 'Nghiệm thu quý — đã thu');
      }
      if (active.length > 0) {
        await markWaiting(
          active[active.length - 1],
          'Quý hiện tại — chờ thu',
        );
      }
      break;
  }
}

async function main() {
  const customers = [
    { code: 'BV175', name: 'Bệnh viện Quân Y 175' },
    { code: 'CCH', name: 'Bệnh viện Đa khoa Khu vực Củ Chi' },
    { code: 'PNT', name: 'Đại học Y khoa Phạm Ngọc Thạch' },
    { code: 'CR', name: 'Bệnh viện Chợ Rẫy' },
    { code: 'ND', name: 'Bệnh viện Nhi Đồng 1' },
    { code: 'UB', name: 'UBND Quận Bình Thạnh' },
    { code: 'TTYT', name: 'Trung tâm Y tế Quận 7' },
    { code: 'DHYK', name: 'Đại học Y Dược TP.HCM' },
    { code: 'BVTW', name: 'Bệnh viện Thống Nhất' },
    { code: 'SYT', name: 'Sở Y tế TP.HCM' },
  ];

  const customerMap: Record<string, string> = {};
  for (const c of customers) {
    const customer = await prisma.customer.upsert({
      where: { code: c.code },
      update: { name: c.name, deletedAt: null },
      create: { code: c.code, name: c.name },
    });
    customerMap[c.code] = customer.id;
  }

  const projects = [
    { code: '175', name: 'BV Quân Y 175', customerCode: 'BV175' },
    { code: 'CCH', name: 'ĐK Củ Chi', customerCode: 'CCH' },
    { code: 'PNT', name: 'ĐH Y khoa PNT', customerCode: 'PNT' },
    { code: 'CR', name: 'BV Chợ Rẫy', customerCode: 'CR' },
    { code: 'ND1', name: 'Nhi Đồng 1', customerCode: 'ND' },
    { code: 'BT', name: 'UBND Bình Thạnh', customerCode: 'UB' },
    { code: 'Q7', name: 'TTYT Quận 7', customerCode: 'TTYT' },
    { code: 'YDH', name: 'ĐH Y Dược', customerCode: 'DHYK' },
    { code: 'TN', name: 'BV Thống Nhất', customerCode: 'BVTW' },
    { code: 'SYT', name: 'Sở Y tế', customerCode: 'SYT' },
  ];

  const projectMap: Record<string, string> = {};
  for (const p of projects) {
    const project = await prisma.project.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        status: ProjectStatus.ACTIVE,
        customerId: customerMap[p.customerCode],
        companyId: COMPANY_ID,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2026-12-31'),
        deletedAt: null,
      },
      create: {
        code: p.code,
        name: p.name,
        status: ProjectStatus.ACTIVE,
        customerId: customerMap[p.customerCode],
        companyId: COMPANY_ID,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    projectMap[p.code] = project.id;
  }

  const contracts: Array<{
    projectCode: string;
    contractNo: string;
    name: string;
    contractValue: number;
    billingCycle: BillingCycle;
    contractType: ContractType;
    startDate: Date;
    endDate: Date;
    paymentTermDays: number;
  }> = [
    // --- 4 HĐ gốc ---
    {
      projectCode: '175',
      contractNo: '175/2026/HĐDV',
      name: 'Hợp đồng dịch vụ BV Quân Y 175',
      contractValue: 7500000000,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.SERVICE,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 45,
    },
    {
      projectCode: 'CCH',
      contractNo: 'CCH/2026/HĐDV',
      name: 'Hợp đồng dịch vụ ĐK Củ Chi',
      contractValue: 28967141800,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.SERVICE,
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-09-30'),
      paymentTermDays: 60,
    },
    {
      projectCode: 'PNT',
      contractNo: 'PNT/2026/HĐDV',
      name: 'Hợp đồng dịch vụ ĐH Y khoa PNT',
      contractValue: 27921252000,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.SERVICE,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 60,
    },
    {
      projectCode: 'CR',
      contractNo: 'CR/2026/HĐDV',
      name: 'Hợp đồng dịch vụ BV Chợ Rẫy',
      contractValue: 10000000000,
      billingCycle: BillingCycle.QUARTERLY,
      contractType: ContractType.SERVICE,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 30,
    },
    // --- ~10 HĐ mẫu mới ---
    {
      projectCode: 'ND1',
      contractNo: 'ND1/2026/HĐDV',
      name: 'HĐDV Nhi Đồng 1 — bảo trì hệ thống',
      contractValue: 4800000000,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.SERVICE,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 45,
    },
    {
      projectCode: 'ND1',
      contractNo: 'ND1/2026/PL01',
      name: 'Phụ lục nâng cấp phần mềm ND1',
      contractValue: 1200000000,
      billingCycle: BillingCycle.MILESTONE,
      contractType: ContractType.APPENDIX,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-08-31'),
      paymentTermDays: 30,
    },
    {
      projectCode: 'BT',
      contractNo: 'BT/2026/HĐCT',
      name: 'HĐ chính UBND Bình Thạnh — số hóa',
      contractValue: 6200000000,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.MAIN,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 60,
    },
    {
      projectCode: 'Q7',
      contractNo: 'Q7/2026/HĐDV',
      name: 'HĐDV TTYT Q7 — vận hành',
      contractValue: 3600000000,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.SERVICE,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 45,
    },
    {
      projectCode: 'YDH',
      contractNo: 'YDH/2026/HĐDV',
      name: 'HĐDV ĐH Y Dược — đào tạo & hỗ trợ',
      contractValue: 5400000000,
      billingCycle: BillingCycle.BIMONTHLY,
      contractType: ContractType.SERVICE,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 60,
    },
    {
      projectCode: 'TN',
      contractNo: 'TN/2026/HĐDV',
      name: 'HĐDV BV Thống Nhất',
      contractValue: 8100000000,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.SERVICE,
      startDate: new Date('2025-11-01'),
      endDate: new Date('2026-10-31'),
      paymentTermDays: 45,
    },
    {
      projectCode: 'TN',
      contractNo: 'TN/2026/HĐKHAC',
      name: 'HĐ khác TN — thuê thiết bị',
      contractValue: 2100000000,
      billingCycle: BillingCycle.QUARTERLY,
      contractType: ContractType.OTHER,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 30,
    },
    {
      projectCode: 'SYT',
      contractNo: 'SYT/2026/HĐCT',
      name: 'HĐ chính Sở Y tế — nền tảng dữ liệu',
      contractValue: 15000000000,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.MAIN,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 60,
    },
    {
      projectCode: 'SYT',
      contractNo: 'SYT/2026/PL02',
      name: 'Phụ lục mở rộng module báo cáo',
      contractValue: 2500000000,
      billingCycle: BillingCycle.MILESTONE,
      contractType: ContractType.APPENDIX,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-09-30'),
      paymentTermDays: 45,
    },
    {
      projectCode: '175',
      contractNo: '175/2026/PL01',
      name: 'Phụ lục 175 — mở rộng phạm vi',
      contractValue: 1800000000,
      billingCycle: BillingCycle.MONTHLY,
      contractType: ContractType.APPENDIX,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 45,
    },
    {
      projectCode: 'CCH',
      contractNo: 'CCH/2026/HĐKHAC',
      name: 'HĐ khác Củ Chi — bảo trì thiết bị',
      contractValue: 950000000,
      billingCycle: BillingCycle.SEMI_ANNUALLY,
      contractType: ContractType.OTHER,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      paymentTermDays: 30,
    },
  ];

  const contractMap: Record<string, string> = {};
  for (const c of contracts) {
    const contract = await prisma.contract.upsert({
      where: { contractNo: c.contractNo },
      update: {
        name: c.name,
        contractValue: c.contractValue,
        billingCycle: c.billingCycle,
        contractType: c.contractType,
        status: ContractStatus.ACTIVE,
        projectId: projectMap[c.projectCode],
        startDate: c.startDate,
        endDate: c.endDate,
        paymentTermDays: c.paymentTermDays,
        deletedAt: null,
      },
      create: {
        projectId: projectMap[c.projectCode],
        contractNo: c.contractNo,
        name: c.name,
        contractValue: c.contractValue,
        billingCycle: c.billingCycle,
        contractType: c.contractType,
        status: ContractStatus.ACTIVE,
        startDate: c.startDate,
        endDate: c.endDate,
        paymentTermDays: c.paymentTermDays,
      },
    });
    contractMap[c.contractNo] = contract.id;
  }

  // ===== HĐ gốc (giữ kịch bản rõ) =====
  await seedScenario({
    contractId: contractMap['175/2026/HĐDV'],
    prefix: '175',
    value: 7500000000,
    startPeriod: '2026-01',
    months: 12,
    workThroughIndex: 8,
    scenario: 'MOSTLY_COLLECTED',
  });

  // CCH chi tiết hơn (11 tháng + chưa NT + nợ)
  {
    const contractId = contractMap['CCH/2026/HĐDV'];
    await resetContractFinance(contractId);
    const periods = monthPeriods('2025-10', 12);
    const plan = distributeAmount(new Decimal('28967141800'), periods, true);
    await seedPlansAndWork(contractId, plan, 10);
    const byPeriod = Object.fromEntries(plan.map((p) => [p.period, p.amount]));

    for (const period of periods.slice(0, 6)) {
      const [y, m] = period.split('-').map(Number);
      await upsertAcceptance({
        contractId,
        acceptanceNo: `CCH-Đợt ${m}/${y}`,
        period,
        amount: byPeriod[period],
        acceptanceDate: new Date(Date.UTC(y, m - 1, 28)),
        invoiceNo: `CCH-HD-${m}/${y}`,
        invoiceDate: new Date(Date.UTC(y, m - 1, 28)),
        status: AcceptanceStatus.APPROVED,
        documentStatus: DocumentStatus.SUBMITTED_UNPAID,
        paymentStatus: AcceptancePaymentStatus.COLLECTED,
        note: 'Đã NT và đã thu',
      });
      await upsertCollection({
        contractId,
        collectionNo: `CCH-TT-${m}/${y}`,
        period,
        amount: Number(byPeriod[period].toFixed()),
        collectionDate: new Date(Date.UTC(y, m - 1 + 2, 5)),
      });
    }
    for (const period of ['2026-04', '2026-05']) {
      const [y, m] = period.split('-').map(Number);
      await upsertAcceptance({
        contractId,
        acceptanceNo: `CCH-Đợt ${m}/${y}`,
        period,
        amount: byPeriod[period],
        status: AcceptanceStatus.DRAFT,
        documentStatus: DocumentStatus.NOT_SUBMITTED,
        paymentStatus: AcceptancePaymentStatus.NOT_ACCEPTED,
        note: 'Chưa nộp hồ sơ = chưa nghiệm thu',
      });
    }
    for (const item of [
      { period: '2026-06', invoiceDate: new Date('2026-05-15') },
      { period: '2026-07', invoiceDate: new Date('2026-06-20') },
      { period: '2026-08', invoiceDate: new Date('2026-07-10') },
    ]) {
      const [y, m] = item.period.split('-').map(Number);
      await upsertAcceptance({
        contractId,
        acceptanceNo: `CCH-Đợt ${m}/${y}`,
        period: item.period,
        amount: byPeriod[item.period],
        acceptanceDate: new Date(Date.UTC(y, m - 1, 28)),
        invoiceNo: `CCH-HD-${m}/${y}`,
        invoiceDate: item.invoiceDate,
        status: AcceptanceStatus.APPROVED,
        documentStatus: DocumentStatus.SUBMITTED_UNPAID,
        paymentStatus: AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT,
        note: 'Chờ CĐT thanh toán',
      });
    }
  }

  await seedScenario({
    contractId: contractMap['PNT/2026/HĐDV'],
    prefix: 'PNT',
    value: 27921252000,
    startPeriod: '2026-01',
    months: 12,
    workThroughIndex: 8,
    scenario: 'PENDING_DOCS',
  });

  await seedScenario({
    contractId: contractMap['CR/2026/HĐDV'],
    prefix: 'CR',
    value: 10000000000,
    startPeriod: '2026-03',
    months: 4,
    firstZero: false,
    workThroughIndex: 2,
    scenario: 'QUARTERLY',
  });

  // ===== ~10 HĐ mới =====
  await seedScenario({
    contractId: contractMap['ND1/2026/HĐDV'],
    prefix: 'ND1',
    value: 4800000000,
    startPeriod: '2026-01',
    months: 12,
    workThroughIndex: 8,
    scenario: 'ON_TRACK',
  });
  await seedScenario({
    contractId: contractMap['ND1/2026/PL01'],
    prefix: 'ND1PL',
    value: 1200000000,
    startPeriod: '2026-03',
    months: 6,
    firstZero: false,
    workThroughIndex: 4,
    scenario: 'WAITING_PAYMENT',
  });
  await seedScenario({
    contractId: contractMap['BT/2026/HĐCT'],
    prefix: 'BT',
    value: 6200000000,
    startPeriod: '2026-02',
    months: 11,
    workThroughIndex: 7,
    scenario: 'MIXED',
  });
  await seedScenario({
    contractId: contractMap['Q7/2026/HĐDV'],
    prefix: 'Q7',
    value: 3600000000,
    startPeriod: '2026-01',
    months: 12,
    workThroughIndex: 7,
    scenario: 'OVERDUE',
  });
  await seedScenario({
    contractId: contractMap['YDH/2026/HĐDV'],
    prefix: 'YDH',
    value: 5400000000,
    startPeriod: '2026-01',
    months: 12,
    workThroughIndex: 6,
    scenario: 'PENDING_DOCS',
  });
  await seedScenario({
    contractId: contractMap['TN/2026/HĐDV'],
    prefix: 'TN',
    value: 8100000000,
    startPeriod: '2025-11',
    months: 12,
    workThroughIndex: 9,
    scenario: 'MOSTLY_COLLECTED',
  });
  await seedScenario({
    contractId: contractMap['TN/2026/HĐKHAC'],
    prefix: 'TNK',
    value: 2100000000,
    startPeriod: '2026-03',
    months: 4,
    firstZero: false,
    workThroughIndex: 2,
    scenario: 'QUARTERLY',
  });
  await seedScenario({
    contractId: contractMap['SYT/2026/HĐCT'],
    prefix: 'SYT',
    value: 15000000000,
    startPeriod: '2026-01',
    months: 12,
    workThroughIndex: 8,
    scenario: 'MIXED',
  });
  await seedScenario({
    contractId: contractMap['SYT/2026/PL02'],
    prefix: 'SYTPL',
    value: 2500000000,
    startPeriod: '2026-04',
    months: 6,
    firstZero: false,
    workThroughIndex: 3,
    scenario: 'EARLY_STAGE',
  });
  await seedScenario({
    contractId: contractMap['175/2026/PL01'],
    prefix: '175PL',
    value: 1800000000,
    startPeriod: '2026-04',
    months: 9,
    workThroughIndex: 4,
    scenario: 'WAITING_PAYMENT',
  });
  await seedScenario({
    contractId: contractMap['CCH/2026/HĐKHAC'],
    prefix: 'CCHK',
    value: 950000000,
    startPeriod: '2026-01',
    months: 2,
    firstZero: false,
    workThroughIndex: 0,
    scenario: 'ON_TRACK',
  });

  console.log('Seed completed successfully');
  console.log(`Contracts seeded: ${contracts.length}`);
  console.log(
    'Scenarios: ON_TRACK, MOSTLY_COLLECTED, PENDING_DOCS, WAITING_PAYMENT, MIXED, OVERDUE, EARLY_STAGE, QUARTERLY',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
