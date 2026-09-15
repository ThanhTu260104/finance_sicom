import { Badge } from '@/components/ui/badge';
import type {
  AcceptanceStatus,
  AcceptancePaymentStatus,
  BillingCycle,
  BottleneckFlag,
  ContractStatus,
  ContractType,
  CustomerStatus,
  DocumentStatus,
  ProjectAssignmentRole,
  ProjectStatus,
  ScheduleStatus,
} from '@/lib/types';

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<
    ProjectStatus,
    { label: string; variant: 'muted' | 'success' | 'warning' | 'danger' | 'default' }
  > = {
    PLANNING: { label: 'Đang lập kế hoạch', variant: 'muted' },
    ACTIVE: { label: 'Đang thực hiện', variant: 'success' },
    SUSPENDED: { label: 'Tạm dừng', variant: 'warning' },
    COMPLETED: { label: 'Hoàn thành', variant: 'default' },
    CANCELLED: { label: 'Đã hủy', variant: 'danger' },
  };
  const item = map[status];
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<
    ContractStatus,
    { label: string; variant: 'muted' | 'success' | 'warning' | 'danger' | 'default' }
  > = {
    DRAFT: { label: 'Nháp', variant: 'muted' },
    ACTIVE: { label: 'Đang thực hiện', variant: 'success' },
    COMPLETED: { label: 'Hoàn thành', variant: 'default' },
    TERMINATED: { label: 'Chấm dứt', variant: 'warning' },
    CANCELLED: { label: 'Hủy', variant: 'danger' },
  };
  const item = map[status];
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <Badge variant={status === 'ACTIVE' ? 'success' : 'muted'}>
      {status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng'}
    </Badge>
  );
}

export const projectStatusLabel: Record<ProjectStatus, string> = {
  PLANNING: 'Đang lập kế hoạch',
  ACTIVE: 'Đang thực hiện',
  SUSPENDED: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const billingCycleLabel: Record<BillingCycle, string> = {
  MONTHLY: 'Hàng tháng',
  BIMONTHLY: '2 tháng/lần',
  QUARTERLY: '3 tháng/lần',
  SEMI_ANNUALLY: '6 tháng/lần',
  ANNUALLY: 'Hàng năm',
  MILESTONE: 'Theo mốc công việc',
  CUSTOM: 'Tùy chỉnh',
};

export const contractTypeLabel: Record<ContractType, string> = {
  MAIN: 'Hợp đồng chính',
  APPENDIX: 'Phụ lục hợp đồng',
  SERVICE: 'Hợp đồng dịch vụ',
  OTHER: 'Khác',
};

export const contractStatusLabel: Record<ContractStatus, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  TERMINATED: 'Chấm dứt',
  CANCELLED: 'Hủy',
};

export const assignmentRoleLabel: Record<ProjectAssignmentRole, string> = {
  PROJECT_MANAGER: 'Quản lý dự án',
  PROJECT_COORDINATOR: 'Điều phối',
  FINANCE: 'Tài chính',
  OTHER: 'Khác',
};

export const acceptanceStatusLabel: Record<AcceptanceStatus, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã trình',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

export const documentStatusLabel: Record<DocumentStatus, string> = {
  NOT_SUBMITTED: 'Chưa nộp',
  SUBMITTED_UNPAID: 'Đã nộp - tiền chưa về',
};

export const acceptancePaymentStatusLabel: Record<
  AcceptancePaymentStatus,
  string
> = {
  NOT_ACCEPTED: 'Chưa nghiệm thu',
  WAITING_CLIENT_PAYMENT: 'Chờ CĐT thanh toán',
  COLLECTED: 'Đã thu tiền',
};

export const scheduleStatusLabel: Record<ScheduleStatus, string> = {
  ON_TRACK: 'Đúng tiến độ',
  BEHIND: 'Chậm tiến độ',
  AHEAD: 'Vượt tiến độ',
};

export const bottleneckLabel: Record<BottleneckFlag, string> = {
  EXECUTION_BEHIND: 'Thực hiện chậm kế hoạch',
  PENDING_ACCEPTANCE: 'Chờ nghiệm thu',
  OUTSTANDING_RECEIVABLE: 'Còn phải thu',
  CONTRACT_BEHIND: 'Hợp đồng chậm tiến độ',
};

export function ScheduleStatusBadge({
  status,
}: {
  status: ScheduleStatus;
}) {
  const map: Record<
    ScheduleStatus,
    { label: string; variant: 'muted' | 'success' | 'warning' | 'danger' | 'default' }
  > = {
    ON_TRACK: { label: 'Đúng tiến độ', variant: 'success' },
    BEHIND: { label: 'Chậm tiến độ', variant: 'danger' },
    AHEAD: { label: 'Vượt tiến độ', variant: 'default' },
  };
  const item = map[status];
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function BottleneckBadge({ flag }: { flag: BottleneckFlag }) {
  const variantMap: Record<
    BottleneckFlag,
    'muted' | 'success' | 'warning' | 'danger' | 'default'
  > = {
    EXECUTION_BEHIND: 'warning',
    PENDING_ACCEPTANCE: 'warning',
    OUTSTANDING_RECEIVABLE: 'default',
    CONTRACT_BEHIND: 'danger',
  };
  return <Badge variant={variantMap[flag]}>{bottleneckLabel[flag]}</Badge>;
}

export function AcceptanceStatusBadge({
  status,
}: {
  status: AcceptanceStatus;
}) {
  const map: Record<
    AcceptanceStatus,
    { label: string; variant: 'muted' | 'success' | 'warning' | 'danger' | 'default' }
  > = {
    DRAFT: { label: 'Nháp', variant: 'muted' },
    SUBMITTED: { label: 'Đã trình', variant: 'warning' },
    APPROVED: { label: 'Đã duyệt', variant: 'success' },
    REJECTED: { label: 'Từ chối', variant: 'danger' },
    CANCELLED: { label: 'Đã hủy', variant: 'danger' },
  };
  const item = map[status];
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant={status === 'SUBMITTED_UNPAID' ? 'success' : 'warning'}>
      {documentStatusLabel[status]}
    </Badge>
  );
}

export function AcceptancePaymentStatusBadge({
  status,
}: {
  status: AcceptancePaymentStatus;
}) {
  const map: Record<
    AcceptancePaymentStatus,
    { label: string; variant: 'muted' | 'success' | 'warning' | 'danger' | 'default' }
  > = {
    NOT_ACCEPTED: { label: 'Chưa nghiệm thu', variant: 'muted' },
    WAITING_CLIENT_PAYMENT: {
      label: 'Chờ CĐT thanh toán',
      variant: 'danger',
    },
    COLLECTED: { label: 'Đã thu tiền', variant: 'success' },
  };
  const item = map[status];
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
