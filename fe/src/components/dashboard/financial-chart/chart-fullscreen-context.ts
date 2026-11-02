import type {
  ContractDashboardResponse,
  DashboardOverviewSummary,
  ProjectDashboardContractRow,
  ProjectDashboardResponse,
} from '@/lib/types';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { formatRoundsAcceptedLabel } from '@/lib/acceptance-rounds-display';
import type { ChartContextItem } from './chart-context-bar';

export function companyOverviewChartContext(
  summary: DashboardOverviewSummary,
): ChartContextItem[] {
  return [
    { label: 'Phạm vi', value: 'Toàn công ty' },
    {
      label: 'Tổng giá trị HĐ',
      value: formatCurrencyVND(summary.contractValue),
    },
    { label: 'Số dự án', value: String(summary.projectCount) },
    { label: 'Số HĐ', value: String(summary.contractCount) },
  ];
}

export function projectDashboardChartContext(
  data: ProjectDashboardResponse,
): ChartContextItem[] {
  const customer = data.project.customer?.name;
  return [
    { label: 'Dự án', value: data.project.name },
    { label: 'Mã dự án', value: data.project.code },
    {
      label: 'Tổng giá trị HĐ',
      value: formatCurrencyVND(data.summary.contractValue),
    },
    { label: 'Số HĐ', value: String(data.summary.contractCount) },
    ...(customer ? [{ label: 'Khách hàng', value: customer }] : []),
  ];
}

export function contractDashboardChartContext(
  data: ContractDashboardResponse,
): ChartContextItem[] {
  const customer = data.contract.project.customer?.name;
  const submitted = data.scheduleSubmittedRounds ?? 0;
  const total = data.scheduleTotalRounds ?? 0;

  return [
    {
      label: 'Hợp đồng',
      value: `${data.contract.contractNo} — ${data.contract.name}`,
    },
    {
      label: 'Dự án',
      value: `${data.contract.project.code} — ${data.contract.project.name}`,
    },
    {
      label: 'Giá trị HĐ',
      value: formatCurrencyVND(data.summary.contractValue),
    },
    {
      label: 'Bắt đầu',
      value: data.contract.startDate
        ? formatDate(data.contract.startDate)
        : '—',
    },
    {
      label: 'Kết thúc',
      value: data.contract.endDate ? formatDate(data.contract.endDate) : '—',
    },
    {
      label: 'Đã nghiệm thu',
      value:
        total > 0
          ? `${formatRoundsAcceptedLabel(submitted, total)} đợt`
          : '—',
    },
    ...(customer ? [{ label: 'Khách hàng', value: customer }] : []),
  ];
}

export function projectContractRowChartContext(
  contract: ProjectDashboardContractRow,
  project: { code: string; name: string },
): ChartContextItem[] {
  const submitted =
    contract.scheduleSubmittedRounds ?? contract.scheduleApprovedRounds ?? 0;
  const total = contract.scheduleTotalRounds ?? 0;

  return [
    {
      label: 'Hợp đồng',
      value: `${contract.contractNo} — ${contract.name}`,
    },
    { label: 'Dự án', value: `${project.code} — ${project.name}` },
    {
      label: 'Giá trị HĐ',
      value: formatCurrencyVND(contract.contractValue),
    },
    {
      label: 'Bắt đầu',
      value: contract.startDate ? formatDate(contract.startDate) : '—',
    },
    {
      label: 'Kết thúc',
      value: contract.endDate ? formatDate(contract.endDate) : '—',
    },
    {
      label: 'Đã nghiệm thu',
      value:
        total > 0
          ? `${formatRoundsAcceptedLabel(submitted, total)} đợt`
          : '—',
    },
  ];
}
