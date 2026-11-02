import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProjectAssignmentRole,
  ProjectReportFileStorage,
  ProjectReportStagedFileStatus,
  ProjectReportStagedUploadTarget,
  Prisma,
  ProjectStatus,
} from '@prisma/client';
import * as fs from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import type { IncomingMessage } from 'http';
import { pipeline } from 'stream/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { fixUtf8Filename } from '../../common/utils/filename-encoding.util';
import { sumDecimals, toDecimalString } from '../../common/utils/decimal.util';
import { PrismaService } from '../../prisma/prisma.service';
import { REVENUE_CONTRACT_WHERE } from '../../common/contract-kind.util';
import {
  MAX_UPLOAD_FILE_SIZE,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from '../../common/constants/upload.constants';
import { CreateProjectReportSubmissionDto } from './dto/create-project-report-submission.dto';
import { InitProjectReportStagedFileDto } from './dto/init-project-report-staged-file.dto';
import { SubmitProjectReportSubmissionDto } from './dto/submit-project-report-submission.dto';
import { ProjectReportR2Service } from './project-report-r2.service';

const MAX_STAGED_FILES_PER_SUBMISSION = 10;
const STAGED_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg',
]);

@Injectable()
export class ProjectReportSubmissionsService {
  private readonly uploadsRoot = path.join(
    process.cwd(),
    'uploads',
    'project-reports',
  );

  private readonly stagedRoot = path.join(this.uploadsRoot, 'staged');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly r2: ProjectReportR2Service,
  ) {}

  private async ensureProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  /** Dự án cho form nộp báo cáo công khai (ưu tiên loại điền). */
  async listProjectsForPublicForm() {
    const baseWhere: Prisma.ProjectWhereInput = {
      deletedAt: null,
      status: ProjectStatus.ACTIVE,
    };
    const fieldTypeFilter: Prisma.ProjectWhereInput = {
      ...baseWhere,
      OR: [
        { projectType: { contains: 'điền', mode: 'insensitive' } },
        { projectType: { contains: 'dien', mode: 'insensitive' } },
        { projectType: { contains: 'field', mode: 'insensitive' } },
      ],
    };
    const include = {
      assignments: {
        where: { role: ProjectAssignmentRole.PROJECT_MANAGER },
        take: 1,
        select: { note: true },
      },
    } as const;

    let projects = await this.prisma.project.findMany({
      where: fieldTypeFilter,
      orderBy: { code: 'asc' },
      include,
    });
    if (projects.length === 0) {
      projects = await this.prisma.project.findMany({
        where: baseWhere,
        orderBy: { code: 'asc' },
        include,
      });
    }
    return projects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      projectType: p.projectType,
      projectManagerName: p.assignments[0]?.note?.trim() || null,
    }));
  }

  async getPrefill(projectId: string, period: string) {
    const project = await this.ensureProject(projectId);
    const contracts = await this.prisma.contract.findMany({
      where: { projectId, deletedAt: null, ...REVENUE_CONTRACT_WHERE },
      orderBy: { contractNo: 'asc' },
      select: {
        id: true,
        contractNo: true,
        name: true,
        contractValue: true,
      },
    });
    const contractIds = contracts.map((c) => c.id);
    const plans =
      contractIds.length === 0
        ? []
        : await this.prisma.revenuePlan.findMany({
            where: { contractId: { in: contractIds }, period },
          });
    const planByContract = new Map(plans.map((p) => [p.contractId, p]));

    return {
      project,
      period,
      driveFolderUrl:
        this.config.get<string>('PROJECT_REPORTS_GOOGLE_DRIVE_FOLDER_URL') ??
        null,
      contracts: contracts.map((c) => {
        const plan = planByContract.get(c.id);
        const systemPlanned = plan?.plannedAmount ?? null;
        return {
          contractId: c.id,
          contractNo: c.contractNo,
          contractName: c.name,
          contractValue: toDecimalString(c.contractValue),
          systemPlannedAmount: systemPlanned
            ? toDecimalString(systemPlanned)
            : null,
          suggestedReportedAmount: systemPlanned
            ? toDecimalString(systemPlanned)
            : '0',
        };
      }),
    };
  }

  async getPeriodSummary(period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('period must be YYYY-MM');
    }

    const projects = await this.prisma.project.findMany({
      where: { deletedAt: null, status: ProjectStatus.ACTIVE },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        customer: { select: { code: true, name: true } },
      },
    });

    const submissions = await this.prisma.projectReportSubmission.findMany({
      where: { deletedAt: null, period },
      orderBy: { submittedAt: 'desc' },
      include: {
        project: { select: { id: true, code: true, name: true } },
        lines: { select: { reportedPlannedAmount: true } },
        files: {
          select: { id: true, fileName: true, sizeBytes: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { files: true } },
      },
    });

    const latestByProject = new Map<string, (typeof submissions)[number]>();
    for (const row of submissions) {
      if (!latestByProject.has(row.projectId)) {
        latestByProject.set(row.projectId, row);
      }
    }

    const submitted: Array<{
      projectId: string;
      projectCode: string;
      projectName: string;
      submissionId: string;
      submittedAt: string;
      title: string | null;
      lineCount: number;
      fileCount: number;
      totalReportedPlannedAmount: string;
      files: Array<{ id: string; fileName: string; sizeBytes: number }>;
    }> = [];
    const pending: Array<{
      projectId: string;
      projectCode: string;
      projectName: string;
      customerCode: string | null;
      customerName: string | null;
    }> = [];

    for (const p of projects) {
      const sub = latestByProject.get(p.id);
      if (sub) {
        submitted.push({
          projectId: p.id,
          projectCode: p.code,
          projectName: p.name,
          submissionId: sub.id,
          submittedAt: sub.submittedAt.toISOString(),
          title: sub.title,
          lineCount: sub.lines.length,
          fileCount: sub._count.files,
          totalReportedPlannedAmount: toDecimalString(
            sumDecimals(sub.lines.map((l) => l.reportedPlannedAmount)),
          ),
          files: sub.files.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            sizeBytes: f.sizeBytes,
          })),
        });
      } else {
        pending.push({
          projectId: p.id,
          projectCode: p.code,
          projectName: p.name,
          customerCode: p.customer?.code ?? null,
          customerName: p.customer?.name ?? null,
        });
      }
    }

    return {
      period,
      totalProjects: projects.length,
      submittedCount: submitted.length,
      pendingCount: pending.length,
      submitted,
      pending,
    };
  }

  async list(query: { projectId?: string; period?: string; limit?: number }) {
    const limit = Math.min(query.limit ?? 50, 100);
    const rows = await this.prisma.projectReportSubmission.findMany({
      where: {
        deletedAt: null,
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.period ? { period: query.period } : {}),
      },
      orderBy: { submittedAt: 'desc' },
      take: limit,
      include: {
        project: { select: { id: true, code: true, name: true } },
        lines: { select: { reportedPlannedAmount: true } },
        _count: { select: { files: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectCode: r.project.code,
      projectName: r.project.name,
      period: r.period,
      title: r.title,
      note: r.note,
      status: r.status,
      submittedAt: r.submittedAt.toISOString(),
      lineCount: r.lines.length,
      fileCount: r._count.files,
      totalReportedPlannedAmount: toDecimalString(
        sumDecimals(r.lines.map((l) => l.reportedPlannedAmount)),
      ),
    }));
  }

  async findOne(id: string) {
    const row = await this.prisma.projectReportSubmission.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { contractNo: 'asc' } },
        files: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException(`Report submission ${id} not found`);
    }
    return {
      id: row.id,
      project: row.project,
      period: row.period,
      title: row.title,
      note: row.note,
      status: row.status,
      submittedAt: row.submittedAt.toISOString(),
      driveFolderUrl:
        this.config.get<string>('PROJECT_REPORTS_GOOGLE_DRIVE_FOLDER_URL') ??
        null,
      lines: row.lines.map((l) => ({
        id: l.id,
        contractId: l.contractId,
        contractNo: l.contractNo,
        contractName: l.contractName,
        period: l.period,
        reportedPlannedAmount: toDecimalString(l.reportedPlannedAmount),
        systemPlannedAmountSnapshot: l.systemPlannedAmountSnapshot
          ? toDecimalString(l.systemPlannedAmountSnapshot)
          : null,
        note: l.note,
      })),
      files: row.files.map((f) => ({
        id: f.id,
        fileName: fixUtf8Filename(f.fileName),
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        storage: f.storage,
        externalUrl: f.externalUrl,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  private validateFileMeta(fileName: string, sizeBytes: number) {
    if (sizeBytes > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException(
        `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_LABEL}`,
      );
    }
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        'Allowed file types: pdf, doc, docx, xls, xlsx, png, jpg, jpeg',
      );
    }
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) return;
    this.validateFileMeta(file.originalname, file.size);
  }

  private submissionDir(submissionId: string) {
    return path.join(this.uploadsRoot, submissionId);
  }

  private stagedFileDir(stagedId: string) {
    return path.join(this.stagedRoot, stagedId);
  }

  private async purgeExpiredStagedFiles() {
    const now = new Date();
    const expired = await this.prisma.projectReportStagedFile.findMany({
      where: { expiresAt: { lt: now } },
      select: { id: true },
    });
    for (const row of expired) {
      await this.removeStagedFileRow(row.id);
    }
  }

  private async removeStagedFileRow(id: string) {
    const row = await this.prisma.projectReportStagedFile.findUnique({
      where: { id },
    });
    if (
      row?.uploadTarget === ProjectReportStagedUploadTarget.R2 &&
      row.objectKey
    ) {
      await this.r2.deleteObject(row.objectKey).catch(() => undefined);
    } else {
      const dir = this.stagedFileDir(id);
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
    await this.prisma.projectReportStagedFile
      .delete({ where: { id } })
      .catch(() => undefined);
  }

  async initStagedUpload(dto: InitProjectReportStagedFileDto) {
    void this.purgeExpiredStagedFiles();

    const fileName = fixUtf8Filename(dto.fileName.trim());
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }
    this.validateFileMeta(fileName, dto.sizeBytes);

    const id = randomUUID();
    const ext = path.extname(fileName).toLowerCase();
    const storedName = `${randomUUID()}${ext}`;
    const expiresAt = new Date(Date.now() + STAGED_UPLOAD_TTL_MS);
    const mimeType = dto.mimeType?.trim() || 'application/octet-stream';
    const useR2 = this.r2.isActive();

    if (useR2) {
      const objectKey = this.r2.stagedObjectKey(id, storedName);
      await this.prisma.projectReportStagedFile.create({
        data: {
          id,
          fileName,
          storedName,
          mimeType,
          expectedSizeBytes: dto.sizeBytes,
          status: ProjectReportStagedFileStatus.PENDING,
          uploadTarget: ProjectReportStagedUploadTarget.R2,
          objectKey,
          expiresAt,
        },
      });
      const uploadUrl = await this.r2.presignedPutUrl(
        objectKey,
        mimeType,
        dto.sizeBytes,
      );
      return {
        fileId: id,
        uploadUrl,
        method: 'PUT' as const,
        uploadTarget: 'r2' as const,
        expiresAt: expiresAt.toISOString(),
        headers: { 'Content-Type': mimeType },
      };
    }

    await fs.mkdir(this.stagedFileDir(id), { recursive: true });
    await this.prisma.projectReportStagedFile.create({
      data: {
        id,
        fileName,
        storedName,
        mimeType,
        expectedSizeBytes: dto.sizeBytes,
        status: ProjectReportStagedFileStatus.PENDING,
        uploadTarget: ProjectReportStagedUploadTarget.LOCAL,
        expiresAt,
      },
    });

    return {
      fileId: id,
      uploadUrl: `/project-report-staged-files/${id}/content`,
      method: 'PUT' as const,
      uploadTarget: 'local' as const,
      expiresAt: expiresAt.toISOString(),
      headers: { 'Content-Type': mimeType },
    };
  }

  async completeStagedUpload(id: string) {
    const staged = await this.prisma.projectReportStagedFile.findUnique({
      where: { id },
    });
    if (!staged) {
      throw new NotFoundException('Upload session not found');
    }
    if (staged.expiresAt.getTime() < Date.now()) {
      await this.removeStagedFileRow(id);
      throw new BadRequestException('Upload session expired');
    }
    if (staged.uploadTarget !== ProjectReportStagedUploadTarget.R2) {
      throw new BadRequestException('Upload session is not R2');
    }
    if (!staged.objectKey) {
      throw new BadRequestException('Missing object key');
    }

    const { size } = await this.r2.headObject(staged.objectKey);
    if (size < 1) {
      throw new BadRequestException('Object empty or not found');
    }
    if (size > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException(
        `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_LABEL}`,
      );
    }
    if (size > staged.expectedSizeBytes) {
      throw new BadRequestException('Uploaded size exceeds declared size');
    }

    await this.prisma.projectReportStagedFile.update({
      where: { id },
      data: {
        status: ProjectReportStagedFileStatus.UPLOADED,
        sizeBytes: size,
      },
    });
    return { ok: true, sizeBytes: size };
  }

  async uploadStagedContent(
    id: string,
    req: IncomingMessage,
    contentLengthHeader?: string,
  ) {
    const staged = await this.prisma.projectReportStagedFile.findUnique({
      where: { id },
    });
    if (!staged) {
      throw new NotFoundException('Upload session not found');
    }
    if (staged.expiresAt.getTime() < Date.now()) {
      await this.removeStagedFileRow(id);
      throw new BadRequestException('Upload session expired');
    }

    const declared =
      contentLengthHeader != null && contentLengthHeader !== ''
        ? Number(contentLengthHeader)
        : staged.expectedSizeBytes;
    if (!Number.isFinite(declared) || declared < 1) {
      throw new BadRequestException('Content-Length is required');
    }
    if (declared > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException(
        `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_LABEL}`,
      );
    }
    if (declared > staged.expectedSizeBytes) {
      throw new BadRequestException('File larger than declared size');
    }

    const dir = this.stagedFileDir(id);
    const destPath = path.join(dir, staged.storedName);
    await fs.mkdir(dir, { recursive: true });

    const writeStream = createWriteStream(destPath, { flags: 'w' });
    try {
      await pipeline(req, writeStream);
    } catch {
      await fs.rm(destPath, { force: true }).catch(() => undefined);
      throw new BadRequestException('Upload interrupted or failed');
    }

    const stat = await fs.stat(destPath);
    if (stat.size > MAX_UPLOAD_FILE_SIZE) {
      await fs.rm(destPath, { force: true }).catch(() => undefined);
      throw new BadRequestException(
        `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_LABEL}`,
      );
    }
    if (stat.size > staged.expectedSizeBytes) {
      await fs.rm(destPath, { force: true }).catch(() => undefined);
      throw new BadRequestException('Uploaded size exceeds declared size');
    }

    await this.prisma.projectReportStagedFile.update({
      where: { id },
      data: {
        status: ProjectReportStagedFileStatus.UPLOADED,
        sizeBytes: stat.size,
      },
    });
  }

  private async assertCreatePayload(dto: CreateProjectReportSubmissionDto) {
    await this.ensureProject(dto.projectId);
    const contracts = await this.prisma.contract.findMany({
      where: {
        projectId: dto.projectId,
        deletedAt: null,
        ...REVENUE_CONTRACT_WHERE,
        id: { in: dto.lines.map((l) => l.contractId) },
      },
    });
    const contractById = new Map(contracts.map((c) => [c.id, c]));
    if (contracts.length !== dto.lines.length) {
      throw new BadRequestException(
        'Một hoặc nhiều hợp đồng không thuộc dự án hoặc không tồn tại',
      );
    }

    const allProjectContracts = await this.prisma.contract.findMany({
      where: {
        projectId: dto.projectId,
        deletedAt: null,
        ...REVENUE_CONTRACT_WHERE,
      },
      select: { id: true },
    });
    if (allProjectContracts.length === 0) {
      throw new BadRequestException('Dự án chưa có hợp đồng');
    }
    const lineIds = new Set(dto.lines.map((l) => l.contractId));
    if (lineIds.size !== dto.lines.length) {
      throw new BadRequestException('Trùng hợp đồng trong báo cáo');
    }
    if (dto.lines.length !== allProjectContracts.length) {
      throw new BadRequestException(
        `Cần khai báo kế hoạch NT cho đủ ${allProjectContracts.length} hợp đồng của dự án`,
      );
    }
    for (const c of allProjectContracts) {
      if (!lineIds.has(c.id)) {
        throw new BadRequestException('Thiếu hợp đồng trong báo cáo');
      }
    }

    const plans = await this.prisma.revenuePlan.findMany({
      where: {
        contractId: { in: dto.lines.map((l) => l.contractId) },
        period: dto.period,
      },
    });
    const planByContract = new Map(plans.map((p) => [p.contractId, p]));

    return { contractById, planByContract };
  }

  /** Copy staged → submission (R2/disk). Chạy ngoài Prisma tx — tránh timeout khi copy file lớn. */
  private async materializeStagedFiles(
    submissionId: string,
    fileIds: string[],
    driveFolderUrl: string | undefined,
  ) {
    if (fileIds.length > MAX_STAGED_FILES_PER_SUBMISSION) {
      throw new BadRequestException(
        `At most ${MAX_STAGED_FILES_PER_SUBMISSION} files per submission`,
      );
    }
    const uniqueIds = [...new Set(fileIds)];
    if (uniqueIds.length !== fileIds.length) {
      throw new BadRequestException('Duplicate staged file id');
    }

    const prepared: Array<{
      fileName: string;
      storedName: string;
      mimeType: string;
      sizeBytes: number;
      storage: ProjectReportFileStorage;
      externalUrl: string | null;
    }> = [];

    for (const fileId of uniqueIds) {
      const staged = await this.prisma.projectReportStagedFile.findUnique({
        where: { id: fileId },
      });
      if (!staged) {
        throw new BadRequestException(`File upload ${fileId} not found`);
      }
      if (staged.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException(`File upload ${fileId} expired`);
      }
      if (staged.status !== ProjectReportStagedFileStatus.UPLOADED) {
        throw new BadRequestException(
          `File ${staged.fileName} chưa upload xong`,
        );
      }

      const fileStoredName = `${randomUUID()}${path.extname(staged.fileName).toLowerCase()}`;

      if (
        staged.uploadTarget === ProjectReportStagedUploadTarget.R2 &&
        staged.objectKey
      ) {
        const destKey = this.r2.submissionObjectKey(
          submissionId,
          fileStoredName,
        );
        await this.r2.copyObject(staged.objectKey, destKey);
        prepared.push({
          fileName: staged.fileName,
          storedName: destKey,
          mimeType: staged.mimeType,
          sizeBytes: staged.sizeBytes ?? staged.expectedSizeBytes,
          storage: ProjectReportFileStorage.R2,
          externalUrl: driveFolderUrl ?? null,
        });
        continue;
      }

      const dir = this.submissionDir(submissionId);
      await fs.mkdir(dir, { recursive: true });
      const srcPath = path.join(this.stagedFileDir(fileId), staged.storedName);
      if (!existsSync(srcPath)) {
        throw new BadRequestException(
          `File ${staged.fileName} missing on disk`,
        );
      }
      const destPath = path.join(dir, fileStoredName);
      await fs.copyFile(srcPath, destPath);

      prepared.push({
        fileName: staged.fileName,
        storedName: fileStoredName,
        mimeType: staged.mimeType,
        sizeBytes: staged.sizeBytes ?? staged.expectedSizeBytes,
        storage: ProjectReportFileStorage.LOCAL,
        externalUrl: driveFolderUrl ?? null,
      });
    }

    return prepared;
  }

  async createWithStagedFiles(dto: SubmitProjectReportSubmissionDto) {
    const { contractById, planByContract } =
      await this.assertCreatePayload(dto);

    const submissionId = randomUUID();
    const driveFolderUrl = this.config.get<string>(
      'PROJECT_REPORTS_GOOGLE_DRIVE_FOLDER_URL',
    );

    const preparedFiles = await this.materializeStagedFiles(
      submissionId,
      dto.fileIds,
      driveFolderUrl,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const submission = await tx.projectReportSubmission.create({
        data: {
          id: submissionId,
          projectId: dto.projectId,
          period: dto.period,
          title: dto.title?.trim() || null,
          note: dto.note?.trim() || null,
        },
      });

      for (const line of dto.lines) {
        const contract = contractById.get(line.contractId)!;
        const plan = planByContract.get(line.contractId);
        await tx.projectReportSubmissionLine.create({
          data: {
            submissionId: submission.id,
            contractId: contract.id,
            contractNo: contract.contractNo,
            contractName: contract.name,
            period: dto.period,
            reportedPlannedAmount: line.reportedPlannedAmount,
            systemPlannedAmountSnapshot: plan?.plannedAmount ?? null,
            note: line.note?.trim() || null,
          },
        });
      }

      for (const file of preparedFiles) {
        await tx.projectReportSubmissionFile.create({
          data: {
            submissionId: submission.id,
            ...file,
          },
        });
      }

      return submission;
    });

    return this.findOne(created.id);
  }

  async create(
    dto: CreateProjectReportSubmissionDto,
    files: Express.Multer.File[] = [],
  ) {
    const { contractById, planByContract } =
      await this.assertCreatePayload(dto);

    for (const f of files) this.validateFile(f);

    const submissionId = randomUUID();
    const dir = this.submissionDir(submissionId);
    if (files.length > 0) {
      await fs.mkdir(dir, { recursive: true });
    }

    const driveFolderUrl = this.config.get<string>(
      'PROJECT_REPORTS_GOOGLE_DRIVE_FOLDER_URL',
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const submission = await tx.projectReportSubmission.create({
        data: {
          id: submissionId,
          projectId: dto.projectId,
          period: dto.period,
          title: dto.title?.trim() || null,
          note: dto.note?.trim() || null,
        },
      });

      for (const line of dto.lines) {
        const contract = contractById.get(line.contractId)!;
        const plan = planByContract.get(line.contractId);
        await tx.projectReportSubmissionLine.create({
          data: {
            submissionId: submission.id,
            contractId: contract.id,
            contractNo: contract.contractNo,
            contractName: contract.name,
            period: dto.period,
            reportedPlannedAmount: line.reportedPlannedAmount,
            systemPlannedAmountSnapshot: plan?.plannedAmount ?? null,
            note: line.note?.trim() || null,
          },
        });
      }

      for (const file of files) {
        const displayName = fixUtf8Filename(file.originalname);
        const storedName = `${randomUUID()}${path.extname(displayName).toLowerCase()}`;
        const fullPath = path.join(dir, storedName);
        await fs.writeFile(fullPath, file.buffer);
        await tx.projectReportSubmissionFile.create({
          data: {
            submissionId: submission.id,
            fileName: displayName,
            storedName,
            mimeType: file.mimetype || 'application/octet-stream',
            sizeBytes: file.size,
            storage: ProjectReportFileStorage.LOCAL,
            externalUrl: driveFolderUrl ?? null,
          },
        });
      }

      return submission;
    });

    return this.findOne(created.id);
  }

  async getDownloadStream(fileId: string) {
    const file = await this.prisma.projectReportSubmissionFile.findFirst({
      where: { id: fileId, deletedAt: null },
      include: { submission: { select: { deletedAt: true } } },
    });
    if (!file || file.submission.deletedAt) {
      throw new NotFoundException('File not found');
    }
    if (file.storage === ProjectReportFileStorage.R2) {
      const stream = await this.r2.getObjectStream(file.storedName);
      return {
        stream,
        fileName: fixUtf8Filename(file.fileName),
        mimeType: file.mimeType,
      };
    }

    const fullPath = path.join(
      this.submissionDir(file.submissionId),
      file.storedName,
    );
    if (!existsSync(fullPath)) {
      throw new NotFoundException('File missing on disk');
    }
    return {
      stream: createReadStream(fullPath),
      fileName: fixUtf8Filename(file.fileName),
      mimeType: file.mimeType,
    };
  }

  /** Xóa mềm báo cáo (chỉ user đăng nhập — không public). */
  async remove(id: string) {
    const row = await this.prisma.projectReportSubmission.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException(`Report submission ${id} not found`);
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.projectReportSubmission.update({
        where: { id },
        data: { deletedAt: now },
      }),
      this.prisma.projectReportSubmissionFile.updateMany({
        where: { submissionId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);
    return { id, deleted: true };
  }
}
