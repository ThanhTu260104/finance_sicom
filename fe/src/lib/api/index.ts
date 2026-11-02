export { ApiError, apiFetch, buildQuery, API_URL } from './client';
export { authApi, isSystemAdmin, SYSTEM_ADMIN_EMAIL } from './auth';
export type {
  AppUser,
  AppUserAccessMode,
  AppUserRole,
  LoginResponse,
  UserAccessPayload,
} from './auth';
export { customersApi } from './customers';
export { companiesApi } from './companies';
export type { CompanyListParams, CompanyPayload } from './companies';
export { employeesApi } from './employees';
export type { EmployeeListParams, EmployeePayload } from './employees';
export { costCategoriesApi } from './cost-categories';
export type { CostCategoryListParams, CostCategoryPayload } from './cost-categories';
export type { CustomerListParams, CustomerPayload } from './customers';
export { projectsApi } from './projects';
export type { ProjectListParams, ProjectPayload } from './projects';
export { contractsApi } from './contracts';
export type {
  ContractBulkPayload,
  ContractListParams,
  ContractOverviewStatistics,
  ContractPayload,
  MaintenanceDailyGridContract,
  MaintenanceDailyGridResponse,
} from './contracts';
export { projectAssignmentsApi } from './project-assignments';
export type { AssignmentBulkItem, AssignmentPayload } from './project-assignments';
export { projectOperatingCostsApi } from './project-operating-costs';
export type { OperatingCostPayload } from './project-operating-costs';
export { revenuePlansApi, acceptancesApi, acceptanceSchedulesApi } from './finance';
export type { RevenuePlanPayload, AcceptancePayload, AcceptanceSchedulePayload } from './finance';
export { financialControlApi } from './financial-control';
export type {
  BulkPlanPayload,
  DraftEqualSplitPayload,
  MonthlyFinancialPayload,
} from './financial-control';
export { collectionsApi } from './collections';
export type { CollectionPayload } from './collections';
export { dashboardApi } from './dashboard';
export { contractAttachmentsApi } from './contract-attachments';
export type { UploadContractAttachmentPayload } from './contract-attachments';
export { acceptanceAttachmentsApi } from './acceptance-attachments';
export type { UploadAcceptanceAttachmentPayload } from './acceptance-attachments';
export { projectReportSubmissionsApi } from './project-report-submissions';
export { musicVotingApi } from './music-voting';
export type {
  MusicTrack,
  VotingCampaign,
  VotingCampaignDetail,
  VotingCampaignStats,
  PublicVotingCampaign,
} from './music-voting';
export type { CreateProjectReportSubmissionPayload } from './project-report-submissions';
export type { ProjectReportSubmissionPeriodSummary } from '@/lib/types';
export { publicReportFormApi } from './public-report-form';
export type { PublicReportFormProject } from './public-report-form';
