import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcceptanceAttachmentKind } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, existsSync } from 'fs';
import { fixUtf8Filename } from '../../common/utils/filename-encoding.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MAX_UPLOAD_FILE_SIZE,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from '../../common/constants/upload.constants';
import { UploadAcceptanceAttachmentDto } from './dto/upload-acceptance-attachment.dto';

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
export class AcceptanceAttachmentsService {
  private readonly uploadsRoot = path.join(
    process.cwd(),
    'uploads',
    'acceptances',
  );

  constructor(private readonly prisma: PrismaService) {}

  private async ensureAcceptance(acceptanceId: string) {
    const acceptance = await this.prisma.acceptance.findFirst({
      where: { id: acceptanceId, deletedAt: null },
    });
    if (!acceptance) {
      throw new NotFoundException(`Acceptance ${acceptanceId} not found`);
    }
    return acceptance;
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException(
        `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_LABEL}`,
      );
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

  private acceptanceDir(acceptanceId: string) {
    return path.join(this.uploadsRoot, acceptanceId);
  }

  private storedFilePath(acceptanceId: string, storedName: string) {
    return path.join(this.acceptanceDir(acceptanceId), storedName);
  }

  private mapAttachment(row: {
    id: string;
    acceptanceId: string;
    kind: AcceptanceAttachmentKind;
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
      acceptanceId: row.acceptanceId,
      kind: row.kind,
      fileName: fixUtf8Filename(row.fileName),
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByAcceptance(acceptanceId: string) {
    await this.ensureAcceptance(acceptanceId);
    const rows = await this.prisma.acceptanceAttachment.findMany({
      where: { acceptanceId, deletedAt: null },
      orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.mapAttachment(row));
  }

  async upload(
    acceptanceId: string,
    file: Express.Multer.File,
    dto: UploadAcceptanceAttachmentDto,
  ) {
    await this.ensureAcceptance(acceptanceId);
    this.validateFile(file);

    const dir = this.acceptanceDir(acceptanceId);
    await fs.mkdir(dir, { recursive: true });

    const displayName = fixUtf8Filename(file.originalname);
    const ext = path.extname(displayName).toLowerCase();
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const targetPath = path.join(dir, storedName);
    await fs.writeFile(targetPath, file.buffer);

    const created = await this.prisma.acceptanceAttachment.create({
      data: {
        acceptanceId,
        kind: dto.kind,
        fileName: displayName,
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        note: dto.note,
      },
    });

    return this.mapAttachment(created);
  }

  async getDownloadStream(id: string) {
    const attachment = await this.prisma.acceptanceAttachment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    const filePath = this.storedFilePath(
      attachment.acceptanceId,
      attachment.storedName,
    );
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      stream: createReadStream(filePath),
      fileName: fixUtf8Filename(attachment.fileName),
      mimeType: attachment.mimeType,
    };
  }

  async remove(id: string) {
    const attachment = await this.prisma.acceptanceAttachment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    const updated = await this.prisma.acceptanceAttachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const filePath = this.storedFilePath(
      attachment.acceptanceId,
      attachment.storedName,
    );
    if (existsSync(filePath)) {
      await fs.unlink(filePath).catch(() => undefined);
    }

    return this.mapAttachment(updated);
  }
}
