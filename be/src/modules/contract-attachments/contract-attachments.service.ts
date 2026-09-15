import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractAttachmentKind } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, existsSync } from 'fs';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadContractAttachmentDto } from './dto/upload-contract-attachment.dto';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

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
export class ContractAttachmentsService {
  private readonly uploadsRoot = path.join(process.cwd(), 'uploads', 'contracts');

  constructor(private readonly prisma: PrismaService) {}

  private async ensureContract(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }
    return contract;
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size must not exceed 20MB');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (
      !ALLOWED_EXTENSIONS.has(ext) &&
      !ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      throw new BadRequestException(
        'Allowed file types: pdf, doc, docx, xls, xlsx, png, jpg, jpeg',
      );
    }
  }

  private contractDir(contractId: string) {
    return path.join(this.uploadsRoot, contractId);
  }

  private storedFilePath(contractId: string, storedName: string) {
    return path.join(this.contractDir(contractId), storedName);
  }

  private mapAttachment(row: {
    id: string;
    contractId: string;
    kind: ContractAttachmentKind;
    fileName: string;
    storedName: string;
    mimeType: string;
    sizeBytes: number;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      contractId: row.contractId,
      kind: row.kind,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByContract(contractId: string) {
    await this.ensureContract(contractId);
    const rows = await this.prisma.contractAttachment.findMany({
      where: { contractId, deletedAt: null },
      orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.mapAttachment(row));
  }

  async upload(
    contractId: string,
    file: Express.Multer.File,
    dto: UploadContractAttachmentDto,
  ) {
    await this.ensureContract(contractId);
    this.validateFile(file);

    const dir = this.contractDir(contractId);
    await fs.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const targetPath = path.join(dir, storedName);
    await fs.writeFile(targetPath, file.buffer);

    const created = await this.prisma.contractAttachment.create({
      data: {
        contractId,
        kind: dto.kind,
        fileName: file.originalname,
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        note: dto.note,
      },
    });

    return this.mapAttachment(created);
  }

  async getDownloadStream(id: string) {
    const attachment = await this.prisma.contractAttachment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    const filePath = this.storedFilePath(
      attachment.contractId,
      attachment.storedName,
    );
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      stream: createReadStream(filePath),
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  async remove(id: string) {
    const attachment = await this.prisma.contractAttachment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    const updated = await this.prisma.contractAttachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const filePath = this.storedFilePath(
      attachment.contractId,
      attachment.storedName,
    );
    if (existsSync(filePath)) {
      await fs.unlink(filePath).catch(() => undefined);
    }

    return this.mapAttachment(updated);
  }
}
