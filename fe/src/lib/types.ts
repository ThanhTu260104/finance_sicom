export type CustomerStatus = 'ACTIVE' | 'INACTIVE';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

export interface Employee {
  id: string;
  code: string;
  fullName: string;
  jobTitle?: string | null;
  status: EmployeeStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export interface CostCategory {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  status: EmployeeStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOperatingCost {
  id: string;
  projectId: string;
  categoryId: string;
  /** Kỳ chi phí — luôn YYYY-MM (tháng/năm) để thống kê và biểu đồ */
  period: string;
  title?: string | null;
  amount: string | number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Pick<CostCategory, 'id' | 'code' | 'name' | 'sortOrder'>;
}

export interface OperatingCostTrendCategoryPoint {
  categoryId: string;
  code: string;
  name: string;
  amount: string;
}

export interface OperatingCostTrendPoint {
  period: string;
  total: string;
  byCategory: OperatingCostTrendCategoryPoint[];
}

export interface OperatingCostTrendResponse {
  fromPeriod: string | null;
  toPeriod: string | null;
  points: OperatingCostTrendPoint[];
  grandTotal: string;
}

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

export type AcceptanceAttachmentKind = 'MINUTES' | 'VOLUME' | 'INVOICE';

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

export interface AcceptanceAttachment {
  id: string;
  acceptanceId: string;
  kind: AcceptanceAttachmentKind;
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
  /** Một đối tác có thể vừa là CĐT, thầu phụ, nhà cung cấp */
  partnerTypes: PartnerType[];
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Loại đối tác */
export type PartnerType = 'INVESTOR' | 'SUBCONTRACTOR' | 'SUPPLIER';

/** Chiều HĐ: INVESTOR = thu tiền CĐT; SUBCONTRACTOR / SUPPLIER = chi tiền */
export type ContractKind = 'INVESTOR' | 'SUBCONTRACTOR' | 'SUPPLIER';

export interface Company {
  id: string;
  code: string;
  name: string;
  taxCode?: string | null;
  address?: string | null;
  status: CustomerStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { contracts: number };
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
  /** Tên trưởng dự án — từ ghi chú vai trò PROJECT_MANAGER (danh sách dự án) */
  projectManagerName?: string | null;
  contracts?: Contract[];
}

export interface ProjectAssignment {
  id: string;
  projectId: string;
  role: ProjectAssignmentRole;
  quantity: number;
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  projectId: string;
  kind: ContractKind;
  companyId?: string | null;
  counterpartyId?: string | null;
  company?: Pick<Company, 'id' | 'code' | 'name'> | null;
  /** Thầu phụ / NCC (HĐ CĐT: null — khách hàng lấy từ dự án) */
  counterparty?: Pick<Customer, 'id' | 'code' | 'name'> | null;
  contractNo: string;
  name: string;
  /** Một hoặc nhiều mã loại, phân cách bằng ";" */
  contractType: string;
  contractValue: string | number;
  signedDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  billingCycle: BillingCycle;
  status: ContractStatus;
  paymentTermDays?: number;
  durationYears?: number | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Pick<Project, 'id' | 'code' | 'name'> | null;
}

export interface RevenuePlan {
  id: string;
  contractId: string;
  period: string;
  batchSequence?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  scheduleId?: string | null;
  plannedAmount: string;
  plannedAcceptanceDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  actualAmount?: string;
  variance?: string;
}

export interface Acceptance {
  id: string;
  contractId: string;
  scheduleId?: string | null;
  acceptanceNo: string;
  period: string;
  acceptanceDate?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  /** Ngày thu tiền (ngày chuyển khoản) */
  paymentDate?: string | null;
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
  startDate?: string | null;
  endDate?: string | null;
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
  batchSequence?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  scheduleId?: string | null;
  plannedAmount: string;
  actualAmount: string;
  variance: string;
  /** Giá trị thực hiện tháng (không phải KH thực hiện). */
  actualWorkAmount?: string;
  monthlyFinancialId?: string | null;
  revenuePlanId?: string | null;
  plannedAcceptanceDate?: string | null;
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
  batchSequence?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  plannedAcceptanceDate?: string | null;
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
  actualWork?: string;
}

export interface DashboardContractRow {
  contractId: string;
  contractNo: string;
  name: string;
  status: ContractStatus;
  projectId: string;
  projectCode: string;
  projectName: string;
  customerId?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  durationYears?: number | null;
  billingCycle?: BillingCycle;
  startDate?: string | null;
  endDate?: string | null;
  contractValue: string;
  /** Kế hoạch NT lũy kế đến kỳ hiện tại (dashboard). */
  plannedToDate?: string;
  totalAccepted: string;
  totalCollected: string;
  remainingAcceptance: string;
  outstandingCollection: string;
  acceptancePercent: string;
  collectionPercent: string;
  scheduleTotalRounds: number;
  scheduleCompletedRounds: number;
  scheduleRemainingRounds: number;
  schedulePendingDocRounds?: number;
  scheduleLateRounds?: number;
  scheduleHint: string;
  monthlyTrend: DashboardMonthlyPoint[];
}

export interface DashboardContractScopeRow {
  contractId: string;
  contractNo: string;
  name: string;
  contractValue: string;
  planned: string;
  actualWork: string;
  accepted: string;
  pendingSubmission: string;
  planShortfall: string;
  collected: string;
  outstandingCollection: string;
  executionRatePercent: string;
  acceptanceRatePercent: string;
  collectionRatePercent: string;
}

export interface DashboardProjectScope {
  projectId: string;
  monthlyTrend: DashboardMonthlyPoint[];
  statusBreakdown: DashboardStatusSlice[];
  currentMonth: {
    planned: string;
    actualWork: string;
    accepted: string;
    pendingSubmission: string;
    unaccepted: string;
    unperformed: string;
    collected: string;
    outstandingCollection: string;
    executionRatePercent: string;
    acceptanceRatePercent: string;
    collectionRatePercent: string;
  };
  contracts: DashboardContractScopeRow[];
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

/** Phase A — GET /dashboard/overview */
export interface DashboardOverviewSummary {
  contractValue: string;
  plannedToDate: string;
  acceptedToDate: string;
  acceptanceGap: string;
  /** KH − NT trong tháng kpiPeriod */
  acceptanceGapPeriod?: string;
  /** Tháng đang xem KPI (YYYY-MM) */
  kpiPeriod?: string;
  /** Kế hoạch NT trong tháng kpiPeriod */
  plannedInCurrentPeriod?: string;
  /** Nghiệm thu trong tháng kỳ hiện tại */
  acceptedInCurrentPeriod?: string;
  /** Thu tiền trong tháng kỳ hiện tại */
  collectedInCurrentPeriod?: string;
  /** Chi phí vận hành dự án trong tháng kpiPeriod */
  operatingCostInCurrentPeriod?: string;
  /** Chi phí vận hành lũy kế đến tháng kpiPeriod */
  operatingCostToDate?: string;
  collectedToDate: string;
  totalCollected: string;
  acceptanceProgressPercent: string;
  collectionProgressPercent: string;
  contractCount: number;
  activeContractCount: number;
  expiringSoonCount: number;
  projectCount: number;
  currentPeriod: string;
  asOf: string;
}

export interface DashboardTrendProjectPeriodRow {
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName: string | null;
  projectManagerName?: string | null;
  plannedAcceptance: string;
  /** Tổng kế hoạch NT KST khai qua form nộp báo cáo */
  reportedRevenue?: string;
  actualWork?: string;
  actualAcceptance: string;
  actualCollection: string;
  operatingCost: string;
  acceptanceGap: string;
  collectionGap: string;
  acceptanceProgressPeriod: string;
  behindSchedule: boolean;
}

export interface DashboardProjectRevenueReport {
  period: string;
  rows: DashboardTrendProjectPeriodRow[];
}

export interface DashboardReceivablesMonitorRow {
  acceptanceId: string;
  acceptanceNo: string;
  period: string;
  contractId: string;
  contractNo: string;
  contractName: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName: string | null;
  acceptanceAmount: string;
  /** Số tiền còn phải thu (chưa thu) */
  unpaidAmount: string;
  agingDays: number | null;
  daysUntilDue: number | null;
}

export interface DashboardReceivablesMonitor {
  fromPeriod: string;
  toPeriod: string;
  rows: DashboardReceivablesMonitorRow[];
}

export interface ProjectReportSubmissionPrefillContract {
  contractId: string;
  contractNo: string;
  contractName: string;
  contractValue: string;
  systemPlannedAmount: string | null;
  suggestedReportedAmount: string;
}

export interface ProjectReportSubmissionPrefill {
  project: { id: string; code: string; name: string };
  period: string;
  driveFolderUrl: string | null;
  contracts: ProjectReportSubmissionPrefillContract[];
}

export interface ProjectReportSubmissionPeriodSummary {
  period: string;
  totalProjects: number;
  submittedCount: number;
  pendingCount: number;
  submitted: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    submissionId: string;
    submittedAt: string;
    title: string | null;
    lineCount: number;
    fileCount: number;
    totalReportedPlannedAmount: string;
    files: Array<{
      id: string;
      fileName: string;
      sizeBytes: number;
    }>;
  }>;
  pending: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    customerCode: string | null;
    customerName: string | null;
  }>;
}

export interface ProjectReportSubmissionListItem {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  period: string;
  title: string | null;
  note: string | null;
  status: string;
  submittedAt: string;
  lineCount: number;
  fileCount: number;
  /** Tổng kế hoạch nghiệm thu KST khai trong báo cáo (form nộp) */
  totalReportedPlannedAmount?: string;
}

export interface ProjectReportSubmissionLine {
  id: string;
  contractId: string;
  contractNo: string;
  contractName: string;
  period: string;
  reportedPlannedAmount: string;
  systemPlannedAmountSnapshot: string | null;
  note: string | null;
}

export interface ProjectReportSubmissionFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storage: string;
  externalUrl: string | null;
  createdAt: string;
}

export interface ProjectReportSubmissionDetail {
  id: string;
  project: { id: string; code: string; name: string };
  period: string;
  title: string | null;
  note: string | null;
  status: string;
  submittedAt: string;
  driveFolderUrl: string | null;
  lines: ProjectReportSubmissionLine[];
  files: ProjectReportSubmissionFile[];
}

export interface DashboardTrendProjectPeriodBreakdown {
  period: string;
  rows: DashboardTrendProjectPeriodRow[];
}

export interface DashboardCumulativeTrendPoint {
  period: string;
  /** Điểm theo đợt NT ("Đợt 1") — có thì hiển thị thay cho tháng */
  label?: string;
  batchSequence?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  plannedAcceptance: string;
  plannedAcceptanceCumulative: string;
  actualAcceptance: string;
  actualAcceptanceCumulative: string;
  /** NT gom theo acceptance.period (kỳ KH) — dùng khi bật toggle trên biểu đồ */
  actualAcceptancePlanPeriod?: string;
  actualAcceptancePlanPeriodCumulative?: string;
  actualCollection: string;
  actualCollectionCumulative: string;
  actualCollectionPlanPeriod?: string;
  actualCollectionPlanPeriodCumulative?: string;
  actualWork?: string;
  actualWorkCumulative?: string;
  operatingCost?: string;
  operatingCostCumulative?: string;
  acceptanceGap: string;
  acceptanceGapPeriod?: string;
  acceptanceProgressPeriod?: string;
}

export interface DashboardByProjectRow {
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName: string | null;
  contractValue: string;
  plannedAcceptanceToDate: string;
  actualAcceptanceToDate: string;
  acceptanceGap: string;
  acceptancePercent: string;
  actualCollectionToDate: string;
  collectionPercent: string;
  plannedAcceptanceCurrentPeriod: string;
  actualAcceptanceCurrentPeriod: string;
  contractCount: number;
  startDate: string | null;
  endDate: string | null;
}

export interface DashboardPendingAcceptanceRow {
  contractId: string;
  contractNo: string;
  contractName: string;
  projectId: string;
  projectCode: string;
  period: string;
  plannedAmount: string;
  actualAcceptance: string;
  gapAmount: string;
}

export interface DashboardPendingCollectionRow {
  contractId: string;
  contractNo: string;
  contractName: string;
  projectId: string;
  projectCode: string;
  period: string;
  acceptedAmount: string;
  collectedAmount: string;
  gapAmount: string;
  agingDays: number | null;
  daysUntilDue: number | null;
}

export interface DashboardActionLists {
  referencePeriod: string;
  pendingAcceptance: DashboardPendingAcceptanceRow[];
  pendingCollection: DashboardPendingCollectionRow[];
}

export interface DashboardKpiMonthBreakdownPlanSlice {
  id: string;
  plannedAmount: string;
  batchSequence?: number | null;
  subBatchIndex?: number | null;
  period?: string;
  actualAcceptance?: string;
}

export interface DashboardKpiOverdueAcceptanceNote {
  batchSequence: number;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  plannedAmount: string;
}

export interface DashboardKpiMonthBreakdownRow {
  contractId: string;
  contractNo: string;
  contractName: string;
  billingCycle?: BillingCycle;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectManagerName?: string | null;
  plannedAmount: string;
  revenuePlansInPeriod?: DashboardKpiMonthBreakdownPlanSlice[];
  actualWorkAmount?: string;
  actualAcceptance: string;
  collectedAmount: string;
  acceptanceGap: string;
  nextPlannedAmount?: string;
  revenuePlansInNextPeriod?: DashboardKpiMonthBreakdownPlanSlice[];
  overdueAcceptanceNotes?: DashboardKpiOverdueAcceptanceNote[];
}

export interface DashboardKpiMonthBreakdown {
  period: string;
  nextPeriod?: string;
  rows: DashboardKpiMonthBreakdownRow[];
}

export interface DashboardExpiringContractRow {
  contractId: string;
  contractNo: string;
  contractName: string;
  status: ContractStatus;
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName: string | null;
  contractValue: string;
  endDate: string | null;
}

export interface DashboardOverviewResponse {
  summary: DashboardOverviewSummary;
  cumulativeTrend: DashboardCumulativeTrendPoint[];
  byProject: DashboardByProjectRow[];
  actionLists?: DashboardActionLists;
  kpiMonthBreakdown?: DashboardKpiMonthBreakdown;
  projectRevenueReport?: DashboardProjectRevenueReport;
  expiringContracts?: DashboardExpiringContractRow[];
  filters: DashboardQueryParams;
}

export type DashboardQueryParams = {
  year?: number;
  fromPeriod?: string;
  toPeriod?: string;
  /** Tháng tham chiếu KPI */
  kpiPeriod?: string;
  /** Tháng tham chiếu mục Cần xử lý */
  actionPeriod?: string;
  /** Tháng tham chiếu 3 cột KPI chi tiết theo dự án */
  projectPeriod?: string;
  /** UI dashboard: dự án đang mở trong Chi tiết theo dự án */
  explorerProjectId?: string;
  /** UI dashboard: hợp đồng đang chọn trong Chi tiết theo dự án */
  explorerContractId?: string;
  projectId?: string;
  customerId?: string;
  contractStatus?: ContractStatus;
  receivablesFromPeriod?: string;
  receivablesToPeriod?: string;
};

export type DashboardTimelineSortField =
  | 'endDate'
  | 'startDate'
  | 'contractValue'
  | 'contractNo'
  | 'acceptanceGap'
  | 'acceptancePercent';

export type DashboardTimelineQueryParams = DashboardQueryParams & {
  page?: number;
  limit?: number;
  sort?: DashboardTimelineSortField;
  order?: 'asc' | 'desc';
};

export interface DashboardTimelineItem {
  contractId: string;
  contractNo: string;
  name: string;
  status: ContractStatus;
  projectId: string;
  projectCode: string;
  projectName: string;
  customerId: string | null;
  customerCode: string | null;
  customerName: string | null;
  contractValue: string;
  startDate: string | null;
  endDate: string | null;
  timeProgressPercent: string | null;
  acceptancePercent: string;
  collectionPercent: string;
  plannedAcceptanceToDate: string;
  actualAcceptanceToDate: string;
  acceptanceGap: string;
  actualCollectionToDate: string;
  expiringSoon: boolean;
}

export interface DashboardTimelineResponse {
  items: DashboardTimelineItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProjectDashboardContractRow {
  contractId: string;
  contractNo: string;
  name: string;
  status: ContractStatus;
  customerName: string | null;
  durationYears?: number | null;
  billingCycle?: BillingCycle;
  contractValue: string;
  startDate: string | null;
  endDate: string | null;
  plannedAcceptanceToDate: string;
  actualAcceptanceToDate: string;
  acceptanceGap: string;
  actualCollectionToDate: string;
  outstandingCollection: string;
  timeProgressPercent: string | null;
  acceptancePercent: string;
  collectionPercent: string;
  scheduleTotalRounds: number;
  scheduleSubmittedRounds: number;
  scheduleCompletedRounds: number;
  /** @deprecated dùng scheduleSubmittedRounds — giữ tương thích API */
  scheduleApprovedRounds: number;
  scheduleRemainingRounds: number;
  schedulePendingDocRounds: number;
  scheduleLateRounds: number;
  scheduleHint: string;
}

export interface ProjectDashboardResponse {
  project: {
    id: string;
    code: string;
    name: string;
    customer: { id: string; code: string; name: string } | null;
  };
  summary: DashboardOverviewSummary;
  cumulativeTrend: DashboardCumulativeTrendPoint[];
  /** Dự án 1 HĐ / các HĐ cùng lịch đợt: một điểm mỗi đợt NT (rỗng nếu khác lịch) */
  batchTrend?: DashboardCumulativeTrendPoint[];
  currentBatchPeriod?: string | null;
  contracts: ProjectDashboardContractRow[];
  timeline: Array<{
    contractId: string;
    contractNo: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    timeProgressPercent: string | null;
    acceptancePercent: string;
    collectionPercent: string;
    plannedAcceptanceToDate: string;
    actualAcceptanceToDate: string;
    actualCollectionToDate: string;
    contractValue: string;
  }>;
}

export interface ContractDashboardSummary {
  contractValue: string;
  plannedToDate: string;
  acceptedToDate: string;
  acceptanceGap: string;
  plannedInCurrentPeriod?: string;
  acceptedInCurrentPeriod?: string;
  collectedInCurrentPeriod?: string;
  collectedToDate: string;
  totalCollected: string;
  remainingAcceptance: string;
  outstandingCollection: string;
  currentPeriod: string;
  asOf: string;
  timeProgressPercent: string | null;
  acceptancePercent: string;
  collectionPercent: string;
  acceptanceProgressPercent?: string;
  collectionProgressPercent?: string;
}

export interface ContractDashboardResponse {
  contract: {
    id: string;
    contractNo: string;
    name: string;
    status: ContractStatus;
    contractValue: string;
    startDate: string | null;
    endDate: string | null;
    billingCycle?: BillingCycle;
    durationYears?: number | null;
    paymentTermDays: number;
    project: {
      id: string;
      code: string;
      name: string;
      customer: { id: string; code: string; name: string } | null;
    };
  };
  summary: ContractDashboardSummary;
  timeline: {
    startDate: string | null;
    endDate: string | null;
    currentPeriod: string;
    asOf: string;
    timeProgressPercent: string | null;
  };
  monthlyTrend: DashboardCumulativeTrendPoint[];
  monthlyRows: DashboardCumulativeTrendPoint[];
  /** HĐ chu kỳ > 1 tháng: một điểm mỗi đợt NT (rỗng nếu NT hàng tháng) */
  batchTrend?: DashboardCumulativeTrendPoint[];
  /** `period` của đợt đang diễn ra (khớp batchTrend) */
  currentBatchPeriod?: string | null;
  scheduleTotalRounds?: number;
  scheduleSubmittedRounds?: number;
  scheduleHint?: string;
}

/** Legacy — GET /dashboard/overview-legacy */
export interface DashboardOverviewLegacy {
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
  byContract: DashboardContractRow[];
  monthlyTrend: DashboardMonthlyPoint[];
  projectScopes: DashboardProjectScope[];
}

/** @deprecated Phân tích bổ sung — dùng DashboardOverviewLegacy */
export type DashboardOverview = DashboardOverviewLegacy;

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

export const PARTNER_TYPES: PartnerType[] = [
  'INVESTOR',
  'SUBCONTRACTOR',
  'SUPPLIER',
];

export const CONTRACT_KINDS: ContractKind[] = [
  'INVESTOR',
  'SUBCONTRACTOR',
  'SUPPLIER',
];

export interface ProjectContractCostPoint {
  period: string;
  subcontractor: string;
  supplier: string;
  total: string;
}

export interface ProjectContractCostRow {
  id: string;
  contractNo: string;
  name: string;
  kind: ContractKind;
  status: ContractStatus;
  contractValue: string;
  company: Pick<Company, 'id' | 'code' | 'name'> | null;
  counterparty: Pick<Customer, 'id' | 'code' | 'name'> | null;
  /** Đã chi trong khoảng kỳ lọc */
  paid: string;
  /** Đã chi lũy kế (mọi kỳ) */
  paidToDate: string;
  remaining: string;
}

export interface ProjectContractCosts {
  fromPeriod: string | null;
  toPeriod: string | null;
  points: ProjectContractCostPoint[];
  totals: { subcontractor: string; supplier: string; total: string };
  contracts: ProjectContractCostRow[];
}

export const EMPLOYEE_STATUSES: EmployeeStatus[] = ['ACTIVE', 'INACTIVE'];

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

export const ACCEPTANCE_ATTACHMENT_KINDS: AcceptanceAttachmentKind[] = [
  'MINUTES',
  'VOLUME',
  'INVOICE',
];

export const acceptanceAttachmentKindLabel: Record<
  AcceptanceAttachmentKind,
  string
> = {
  MINUTES: 'Biên bản nghiệm thu',
  VOLUME: 'Khối lượng',
  INVOICE: 'Hóa đơn',
};

/** Seed company UUID — backend chưa có Company API. */
export const DEFAULT_COMPANY_ID = '00000000-0000-4000-8000-000000000001';
