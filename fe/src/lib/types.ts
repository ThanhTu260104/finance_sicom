export type CustomerStatus = 'ACTIVE' | 'INACTIVE';

export type ProjectStatus =
  | 'PLANNING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ContractType = 'MAINTENANCE' | 'OPERATION' | 'REPAIR' | 'PROJECT';

export type BillingCycle =
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'ANNUALLY'
  | 'MILESTONE'
  | 'CUSTOM';

export type ContractStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'TERMINATED'
  | 'CANCELLED';

export type ProjectAssignmentRole =
  | 'PROJECT_MANAGER'
  | 'PROJECT_COORDINATOR'
  | 'FINANCE'
  | 'OTHER';

export type AcceptanceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type DocumentStatus = 'NOT_SUBMITTED' | 'SUBMITTED_UNPAID';

export type AcceptancePaymentStatus =
  | 'NOT_ACCEPTED'
  | 'WAITING_CLIENT_PAYMENT'
  | 'COLLECTED';

export type ContractAttachmentKind = 'CONTRACT' | 'APPENDIX' | 'OTHER';

export interface ContractAttachment {
  id: string;
  contractId: string;
  kind: ContractAttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  taxCode?: string | null;
  address?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status: CustomerStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  companyId: string;
  customerId?: string | null;
  projectType?: string | null;
  location?: string | null;
  address?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: ProjectStatus;
  description?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Pick<Customer, 'id' | 'code' | 'name'> | null;
  _count?: { contracts: number };
  assignments?: ProjectAssignment[];
  contracts?: Contract[];
}

export interface ProjectAssignment {
  id: string;
  projectId: string;
  employeeId: string;
  role: ProjectAssignmentRole;
  startDate?: string | null;
  endDate?: string | null;
  isPrimary: boolean;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  projectId: string;
  contractNo: string;
  name: string;
  contractType: ContractType;
  contractValue: string | number;
  signedDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  billingCycle: BillingCycle;
  status: ContractStatus;
  paymentTermDays?: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Pick<Project, 'id' | 'code' | 'name'> | null;
}

export interface RevenuePlan {
  id: string;
  contractId: string;
  period: string;
  plannedAmount: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  actualAmount?: string;
  variance?: string;
}

export interface Acceptance {
  id: string;
  contractId: string;
  acceptanceNo: string;
  period: string;
  acceptanceDate?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  amount: string;
  status: AcceptanceStatus;
  documentStatus: DocumentStatus;
  paymentStatus: AcceptancePaymentStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  paymentTermDays?: number;
  paymentDueDate?: string | null;
  agingDays?: number | null;
  daysUntilDue?: number | null;
}

export type AcceptanceScheduleMethod = 'FIXED_AMOUNT' | 'PERCENT_OF_CONTRACT' | 'QUANTITY';

export interface AcceptanceSchedule {
  id: string;
  contractId: string;
  sequence: number;
  name: string;
  startPeriod?: string | null;
  endPeriod?: string | null;
  dueDate?: string | null;
  method: AcceptanceScheduleMethod;
  plannedAmount?: string | null;
  percentOfContract?: string | null;
  plannedQuantity?: string | null;
  actualQuantity?: string | null;
  unit?: string | null;
  note?: string | null;
  _count?: { acceptances: number };
}

export interface PeriodComparison {
  period: string;
  plannedAmount: string;
  actualAmount: string;
  variance: string;
  revenuePlanId?: string | null;
  note?: string | null;
}

export interface ContractFinanceSummary {
  contractValue: string;
  totalPlanned: string;
  totalAccepted: string;
  totalCollected: string;
  outstandingCollection: string;
  remainingAcceptance: string;
  overContractValue?: boolean;
  currentPeriod?: string;
  monthlyRequiredAcceptance?: string;
  averageMonthlyPlanned?: string;
  acceptanceRatePercent?: string;
  plannedToDate?: string;
  submittedToDate?: string;
  pendingSubmissionToDate?: string;
  remainingPlanAfterPending?: string;
  scheduleRatePercent?: string;
  scheduleVariance?: string;
  planMatchesContractValue: boolean;
  comparison: PeriodComparison[];
  data: RevenuePlan[];
}

export type ScheduleStatus = 'ON_TRACK' | 'BEHIND' | 'AHEAD';

export type BottleneckFlag =
  | 'EXECUTION_BEHIND'
  | 'PENDING_ACCEPTANCE'
  | 'OUTSTANDING_RECEIVABLE'
  | 'CONTRACT_BEHIND';

export type TimelineStatus = 'PAST' | 'CURRENT' | 'FUTURE';

export interface Collection {
  id: string;
  contractId: string;
  collectionNo: string;
  period: string;
  collectionDate?: string | null;
  amount: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyFinancial {
  id: string;
  contractId: string;
  period: string;
  actualWorkAmount: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialControlRow {
  period: string;
  periodLabel: string;
  monthlyFinancialId?: string | null;
  revenuePlanId?: string | null;
  plannedAmount: string;
  actualWorkAmount: string;
  acceptanceAmount: string;
  collectedAmount: string;
  cumulativePlanned: string;
  cumulativeAcceptance: string;
  cumulativeCollection: string;
  remainingAcceptance: string;
  remainingCollection: string;
  variance: string;
  cumulativeVariance: string;
  scheduleStatus: ScheduleStatus;
  bottlenecks: BottleneckFlag[];
  timelineStatus: TimelineStatus;
  note?: string | null;
}

export interface FinancialControlSummary {
  contractValue: string;
  totalPlanned: string;
  totalActualWork: string;
  totalAccepted: string;
  totalCollected: string;
  remainingAcceptance: string;
  outstandingCollection: string;
  scheduleVariance: string;
  scheduleStatus: ScheduleStatus;
  planMatchesContractValue: boolean;
  overContractValue: boolean;
  currentPeriod?: string;
  monthlyRequiredAcceptance?: string;
  averageMonthlyPlanned?: string;
  acceptanceRatePercent?: string;
  plannedToDate?: string;
  submittedToDate?: string;
  pendingSubmissionToDate?: string;
  remainingPlanAfterPending?: string;
  scheduleRatePercent?: string;
  collectionRatePercent?: string;
}

export interface FinancialControlResponse {
  contract: Contract & {
    project?: Pick<Project, 'id' | 'code' | 'name'> | null;
  };
  summary: FinancialControlSummary;
  timeline: {
    startDate?: string | null;
    endDate?: string | null;
    currentPeriod: string;
    periods: string[];
  };
  rows: FinancialControlRow[];
  warnings: string[];
}

export interface DashboardStatusSlice {
  key: string;
  label: string;
  amount: string;
}

export interface DashboardProjectRow {
  projectId: string;
  projectCode: string;
  projectName: string;
  contractValue: string;
  planned: string;
  actualWork: string;
  accepted: string;
  pendingSubmission: string;
  planShortfall: string;
  collected: string;
  remainingAcceptance: string;
  outstandingCollection: string;
  acceptanceRatePercent: string;
}

export interface DashboardMonthlyPoint {
  period: string;
  planned: string;
  accepted: string;
  collected: string;
}

export interface ProjectFinanceStatusSlice {
  key: string;
  label: string;
  amount: string;
}

export interface ProjectContractFinanceOverview {
  contractId: string;
  contractNo: string;
  name: string;
  contractValue: string;
  status: ContractStatus;
  summary: FinancialControlSummary;
  rows: FinancialControlRow[];
  timeline: FinancialControlResponse['timeline'];
}

export interface ProjectFinanceOverview {
  project: Pick<Project, 'id' | 'code' | 'name'>;
  summary: {
    contractCount: number;
    totalValue: string;
    totalAccepted: string;
    totalCollected: string;
    remainingAcceptance: string;
    outstandingCollection: string;
    overContractValue: boolean;
    acceptanceRatePercent: string;
    collectionRatePercent: string;
    currentPeriod?: string | null;
    plannedToDate?: string;
    submittedToDate?: string;
    pendingSubmissionToDate?: string;
    remainingPlanAfterPending?: string;
  };
  statusBreakdown: ProjectFinanceStatusSlice[];
  contracts: ProjectContractFinanceOverview[];
}

export interface DashboardOverview {
  summary: {
    projectCount: number;
    contractCount: number;
    contractValue: string;
    totalPlanned: string;
    totalAccepted: string;
    totalCollected: string;
    remainingAcceptance: string;
    outstandingCollection: string;
    overContractValue: boolean;
    acceptanceRatePercent: string;
    collectionRatePercent: string;
    planCompletionPercent: string;
    currentPeriod: string;
    plannedToDate: string;
    submittedToDate: string;
    pendingSubmissionToDate: string;
    remainingPlanAfterPending: string;
    delayedAmountToDate: string;
    currentPlanned: string;
    currentActualWork: string;
    currentAccepted: string;
    currentPendingSubmission: string;
    currentUnaccepted: string;
    currentDelayedAmount: string;
    currentCollected: string;
    currentOutstandingCollection: string;
    currentUnperformed: string;
    currentExecutionRatePercent: string;
    currentAcceptanceRatePercent: string;
    currentCollectionRatePercent: string;
  };
  statusBreakdown: DashboardStatusSlice[];
  byProject: DashboardProjectRow[];
  monthlyTrend: DashboardMonthlyPoint[];
  alerts: Array<{
    type: 'OUTSTANDING' | 'PENDING_ACCEPTANCE';
    projectCode: string;
    message: string;
    amount: string;
  }>;
}

export const PROJECT_STATUSES: ProjectStatus[] = [
  'PLANNING',
  'ACTIVE',
  'SUSPENDED',
  'COMPLETED',
  'CANCELLED',
];

export const CONTRACT_STATUSES: ContractStatus[] = [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'TERMINATED',
  'CANCELLED',
];

export const CONTRACT_TYPES: ContractType[] = [
  'MAINTENANCE',
  'OPERATION',
  'REPAIR',
  'PROJECT',
];

export const BILLING_CYCLES: BillingCycle[] = [
  'MONTHLY',
  'BIMONTHLY',
  'QUARTERLY',
  'SEMI_ANNUALLY',
  'ANNUALLY',
  'MILESTONE',
  'CUSTOM',
];

export const CUSTOMER_STATUSES: CustomerStatus[] = ['ACTIVE', 'INACTIVE'];

export const PROJECT_ASSIGNMENT_ROLES: ProjectAssignmentRole[] = [
  'PROJECT_MANAGER',
  'PROJECT_COORDINATOR',
  'FINANCE',
  'OTHER',
];

export const ACCEPTANCE_STATUSES: AcceptanceStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  'NOT_SUBMITTED',
  'SUBMITTED_UNPAID',
];

export const ACCEPTANCE_PAYMENT_STATUSES: AcceptancePaymentStatus[] = [
  'NOT_ACCEPTED',
  'WAITING_CLIENT_PAYMENT',
  'COLLECTED',
];

export const CONTRACT_ATTACHMENT_KINDS: ContractAttachmentKind[] = [
  'CONTRACT',
  'APPENDIX',
  'OTHER',
];

export const contractAttachmentKindLabel: Record<ContractAttachmentKind, string> =
  {
    CONTRACT: 'Hợp đồng',
    APPENDIX: 'Phụ lục',
    OTHER: 'Khác',
  };

/** Seed company UUID — backend chưa có Company API. */
export const DEFAULT_COMPANY_ID = '00000000-0000-4000-8000-000000000001';
