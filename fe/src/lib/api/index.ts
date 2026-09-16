export { ApiError, apiFetch, buildQuery } from './client';
export { customersApi } from './customers';
export type { CustomerListParams, CustomerPayload } from './customers';
export { projectsApi } from './projects';
export type { ProjectListParams, ProjectPayload } from './projects';
export { contractsApi } from './contracts';
export type {
  ContractBulkPayload,
  ContractListParams,
  ContractPayload,
} from './contracts';
export { projectAssignmentsApi } from './project-assignments';
export type { AssignmentPayload } from './project-assignments';
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
