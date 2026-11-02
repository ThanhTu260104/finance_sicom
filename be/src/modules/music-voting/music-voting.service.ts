import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MusicTrack,
  MusicTrackConversionStatus,
  MusicTrackPublicStatus,
  Prisma,
  VoteRecordStatus,
  VotingCampaign,
  VotingCampaignStatus,
} from '@prisma/client';
import { createReadStream, existsSync, statSync } from 'fs';
import type { Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MUSIC_TRACK_MAX_BYTES } from './music-track-multer.options';
import { fixUtf8Filename } from '../../common/utils/filename-encoding.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMusicTrackDto } from './dto/create-music-track.dto';
import { UpdateMusicTrackDto } from './dto/update-music-track.dto';
import { CreateVotingCampaignDto } from './dto/create-voting-campaign.dto';
import { UpdateVotingCampaignDto } from './dto/update-voting-campaign.dto';
import { AddCampaignTrackDto } from './dto/add-campaign-track.dto';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { InitMusicTrackR2UploadDto } from './dto/init-music-track-r2-upload.dto';
import { InitMusicTrackR2ReuploadDto } from './dto/init-music-track-r2-reupload.dto';
import { MusicTrackR2Service } from './music-track-r2.service';
import {
  pipeTrackMediaWithRange,
  resolveTrackStreamMimeType,
} from './music-track-stream.util';

const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'video/mp4',
  'video/quicktime',
  'video/x-quicktime',
]);

const AUDIO_EXT = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.webm',
  '.mp4',
  '.mov',
]);

function playableRelativePath(row: MusicTrack): string | null {
  return row.mp3FilePath?.trim() || row.originalFilePath?.trim() || null;
}

function serializeTrack(row: MusicTrack) {
  return {
    ...row,
    fileSizeBytes: row.fileSizeBytes?.toString() ?? null,
    hasAudio:
      playableRelativePath(row) != null &&
      row.conversionStatus === MusicTrackConversionStatus.READY,
  };
}

function serializeCampaign(row: VotingCampaign) {
  return row;
}

type ResultPublishConfig = {
  published?: boolean;
  publishAfterEnd?: boolean;
};

function normalizeEmployeeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizePersonName(raw: string): string {
  return raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function canPublicSeeStats(
  campaign: VotingCampaign,
  now: Date,
): boolean {
  const cfg = (campaign.resultPublishConfig ?? {}) as ResultPublishConfig;
  if (cfg.published === true) return true;
  if (cfg.publishAfterEnd === true && now.getTime() > campaign.endAt.getTime()) {
    return true;
  }
  if (
    campaign.status === VotingCampaignStatus.CLOSED ||
    campaign.status === VotingCampaignStatus.ARCHIVED
  ) {
    return true;
  }
  return false;
}

@Injectable()
export class MusicVotingService {
  private readonly uploadsRoot = path.join(
    process.cwd(),
    'uploads',
    'music-tracks',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: MusicTrackR2Service,
  ) {}

  private async isVoterWhitelistRequired(campaignId: string): Promise<boolean> {
    const count = await this.prisma.votingCampaignVoter.count({
      where: { campaignId },
    });
    return count > 0;
  }

  private async findWhitelistVoterByEmailAndName(
    campaignId: string,
    emailRaw: string,
    fullNameRaw: string,
  ) {
    const email = normalizeEmail(emailRaw);
    const fullNameNorm = normalizePersonName(fullNameRaw);
    if (!email || !fullNameNorm) return null;

    const rows = await this.prisma.votingCampaignVoter.findMany({
      where: { campaignId, email: { not: null } },
    });

    for (const row of rows) {
      if (!row.email?.trim()) continue;
      const rowEmail = normalizeEmail(row.email);
      const rowName = normalizePersonName(row.fullName ?? '');
      if (rowEmail === email && rowName === fullNameNorm) {
        return row;
      }
    }
    return null;
  }

  private trackStorageDir(trackId: string) {
    return path.join(this.uploadsRoot, trackId);
  }

  private absoluteAudioPath(relative: string) {
    return path.join(this.uploadsRoot, relative);
  }

  private validateAudioFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Cần chọn file nhạc');
    }
    if (file.size > MUSIC_TRACK_MAX_BYTES) {
      throw new BadRequestException('File nhạc không được vượt quá 100MB');
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const mimeOk =
      AUDIO_MIME.has(mime) ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream';
    if (!AUDIO_EXT.has(ext) && !mimeOk) {
      throw new BadRequestException(
        'Định dạng hỗ trợ: mp3, wav, m4a, aac, ogg, webm, mp4, mov',
      );
    }
  }

  private isUnique(err: unknown) {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }

  async listTracks(search?: string) {
    const q = search?.trim();
    const rows = await this.prisma.musicTrack.findMany({
      where: q
        ? {
            OR: [
              { songCode: { contains: q, mode: 'insensitive' } },
              { songTitle: { contains: q, mode: 'insensitive' } },
              { performerName: { contains: q, mode: 'insensitive' } },
              { contestantCode: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ displayOrder: 'asc' }, { songCode: 'asc' }],
    });
    return rows.map(serializeTrack);
  }

  async createTrackWithAudio(dto: CreateMusicTrackDto, file: Express.Multer.File) {
    const row = await this.createTrack(dto);
    try {
      return await this.uploadTrackAudio(row.id, file);
    } catch (err) {
      await this.prisma.musicTrack.delete({ where: { id: row.id } }).catch(() => {});
      await fs.rm(this.trackStorageDir(row.id), { recursive: true, force: true });
      throw err;
    }
  }

  async createTrack(dto: CreateMusicTrackDto) {
    try {
      const row = await this.prisma.musicTrack.create({
        data: {
          songCode: dto.songCode.trim(),
          contestantCode: dto.contestantCode.trim(),
          performerName: dto.performerName.trim(),
          authorName: dto.authorName.trim(),
          songTitle: dto.songTitle.trim(),
          originalFilePath: dto.originalFilePath?.trim() || null,
          mp3FilePath: dto.mp3FilePath?.trim() || null,
          mimeType: dto.mimeType?.trim() || null,
          fileSizeBytes: dto.fileSizeBytes
            ? BigInt(dto.fileSizeBytes)
            : null,
          conversionStatus: dto.conversionStatus,
          publicStatus: dto.publicStatus,
          displayOrder: dto.displayOrder ?? 0,
        },
      });
      return serializeTrack(row);
    } catch (err) {
      if (this.isUnique(err)) {
        throw new ConflictException(`Mã ca khúc "${dto.songCode}" đã tồn tại.`);
      }
      throw err;
    }
  }

  async updateTrack(id: string, dto: UpdateMusicTrackDto) {
    await this.ensureTrack(id);
    try {
      const row = await this.prisma.musicTrack.update({
        where: { id },
        data: {
          ...(dto.songCode !== undefined
            ? { songCode: dto.songCode.trim() }
            : {}),
          ...(dto.contestantCode !== undefined
            ? { contestantCode: dto.contestantCode.trim() }
            : {}),
          ...(dto.performerName !== undefined
            ? { performerName: dto.performerName.trim() }
            : {}),
          ...(dto.authorName !== undefined
            ? { authorName: dto.authorName.trim() }
            : {}),
          ...(dto.songTitle !== undefined
            ? { songTitle: dto.songTitle.trim() }
            : {}),
          ...(dto.originalFilePath !== undefined
            ? { originalFilePath: dto.originalFilePath?.trim() || null }
            : {}),
          ...(dto.mp3FilePath !== undefined
            ? { mp3FilePath: dto.mp3FilePath?.trim() || null }
            : {}),
          ...(dto.mimeType !== undefined
            ? { mimeType: dto.mimeType?.trim() || null }
            : {}),
          ...(dto.fileSizeBytes !== undefined
            ? {
                fileSizeBytes: dto.fileSizeBytes
                  ? BigInt(dto.fileSizeBytes)
                  : null,
              }
            : {}),
          ...(dto.conversionStatus !== undefined
            ? { conversionStatus: dto.conversionStatus }
            : {}),
          ...(dto.publicStatus !== undefined
            ? { publicStatus: dto.publicStatus }
            : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
        },
      });
      return serializeTrack(row);
    } catch (err) {
      if (this.isUnique(err)) {
        throw new ConflictException('Mã ca khúc đã tồn tại.');
      }
      throw err;
    }
  }

  private async purgeTrackRelations(trackId: string) {
    await this.prisma.$transaction([
      this.prisma.vote.deleteMany({ where: { trackId } }),
      this.prisma.votingCampaignTrack.deleteMany({ where: { trackId } }),
    ]);
  }

  async removeTrack(id: string) {
    const row = await this.ensureTrack(id);
    await this.purgeTrackRelations(id);
    const stored = playableRelativePath(row);
    if (stored && this.r2.isR2ObjectKey(stored)) {
      await this.r2.deleteObject(stored).catch(() => undefined);
    }
    await this.prisma.musicTrack.delete({ where: { id } });
    await fs.rm(this.trackStorageDir(id), { recursive: true, force: true });
    return { ok: true, id };
  }

  async removeTracksBulk(ids: string[]) {
    const unique = [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
    if (unique.length === 0) {
      throw new BadRequestException('Danh sách ca khúc trống');
    }
    const removed: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const id of unique) {
      try {
        await this.removeTrack(id);
        removed.push(id);
      } catch (e) {
        failed.push({
          id,
          reason: e instanceof Error ? e.message : 'Không xóa được',
        });
      }
    }
    return { ok: failed.length === 0, removed: removed.length, removedIds: removed, failed };
  }

  private validateUploadMeta(
    fileName: string,
    mimeType: string,
    sizeBytes: number,
  ) {
    this.validateAudioFile({
      originalname: fileName,
      mimetype: mimeType,
      size: sizeBytes,
    } as Express.Multer.File);
  }

  private audioStoredName(fileName: string) {
    const ext = path.extname(fileName).toLowerCase() || '.mp3';
    return `audio${ext}`;
  }

  async initNewTrackR2Upload(dto: InitMusicTrackR2UploadDto) {
    this.validateUploadMeta(dto.fileName, dto.mimeType, dto.sizeBytes);
    const row = await this.createTrack({
      songCode: dto.songCode,
      contestantCode: dto.contestantCode,
      performerName: dto.performerName,
      authorName: dto.authorName,
      songTitle: dto.songTitle,
      publicStatus: dto.publicStatus,
    });

    if (!this.r2.isActive()) {
      return {
        trackId: row.id,
        uploadTarget: 'local' as const,
        uploadUrl: `/music-tracks/${row.id}/audio`,
        method: 'POST' as const,
        headers: {} as Record<string, string>,
      };
    }

    const storedName = this.audioStoredName(dto.fileName);
    const objectKey = this.r2.trackObjectKey(row.id, storedName);
    await this.prisma.musicTrack.update({
      where: { id: row.id },
      data: {
        originalFilePath: objectKey,
        mp3FilePath: null,
        mimeType: dto.mimeType.trim() || 'application/octet-stream',
        conversionStatus: MusicTrackConversionStatus.PENDING,
      },
    });
    const uploadUrl = await this.r2.presignedPutUrl(
      objectKey,
      dto.mimeType.trim() || 'application/octet-stream',
      dto.sizeBytes,
    );
    return {
      trackId: row.id,
      uploadTarget: 'r2' as const,
      uploadUrl,
      method: 'PUT' as const,
      headers: { 'Content-Type': dto.mimeType.trim() || 'application/octet-stream' },
    };
  }

  async initTrackR2Reupload(trackId: string, dto: InitMusicTrackR2ReuploadDto) {
    await this.ensureTrack(trackId);
    this.validateUploadMeta(dto.fileName, dto.mimeType, dto.sizeBytes);

    if (!this.r2.isActive()) {
      return {
        trackId,
        uploadTarget: 'local' as const,
        uploadUrl: `/music-tracks/${trackId}/audio`,
        method: 'POST' as const,
        headers: {} as Record<string, string>,
      };
    }

    const storedName = this.audioStoredName(dto.fileName);
    const objectKey = this.r2.trackObjectKey(trackId, storedName);
    const old = await this.ensureTrack(trackId);
    const oldKey = playableRelativePath(old);
    if (oldKey && this.r2.isR2ObjectKey(oldKey) && oldKey !== objectKey) {
      await this.r2.deleteObject(oldKey).catch(() => undefined);
    }

    await this.prisma.musicTrack.update({
      where: { id: trackId },
      data: {
        originalFilePath: objectKey,
        mp3FilePath: null,
        mimeType: dto.mimeType.trim() || 'application/octet-stream',
        fileSizeBytes: null,
        conversionStatus: MusicTrackConversionStatus.PENDING,
      },
    });

    const uploadUrl = await this.r2.presignedPutUrl(
      objectKey,
      dto.mimeType.trim() || 'application/octet-stream',
      dto.sizeBytes,
    );
    return {
      trackId,
      uploadTarget: 'r2' as const,
      uploadUrl,
      method: 'PUT' as const,
      headers: { 'Content-Type': dto.mimeType.trim() || 'application/octet-stream' },
    };
  }

  async completeTrackR2Upload(trackId: string) {
    const row = await this.ensureTrack(trackId);
    const objectKey = playableRelativePath(row);
    if (!objectKey || !this.r2.isR2ObjectKey(objectKey)) {
      throw new BadRequestException('Ca khúc không dùng upload R2');
    }
    if (row.conversionStatus === MusicTrackConversionStatus.READY) {
      return serializeTrack(row);
    }

    const { size, contentType } = await this.r2.headObject(objectKey);
    if (size < 1) {
      throw new BadRequestException(
        'Chưa thấy file trên R2 — thử upload lại',
      );
    }
    if (size > MUSIC_TRACK_MAX_BYTES) {
      throw new BadRequestException('File nhạc không được vượt quá 100MB');
    }

    const ext = path.extname(objectKey).toLowerCase();
    const isMp3 = ext === '.mp3';
    const updated = await this.prisma.musicTrack.update({
      where: { id: trackId },
      data: {
        fileSizeBytes: BigInt(size),
        mimeType: contentType?.trim() || row.mimeType,
        mp3FilePath: isMp3 ? objectKey : null,
        conversionStatus: MusicTrackConversionStatus.READY,
      },
    });
    return serializeTrack(updated);
  }

  private async persistAudioFile(
    trackId: string,
    file: Express.Multer.File,
  ): Promise<MusicTrack> {
    this.validateAudioFile(file);
    const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
    const storedName = `audio${ext}`;
    const relative = `${trackId}/${storedName}`;
    const dir = this.trackStorageDir(trackId);
    const dest = path.join(dir, storedName);
    await fs.mkdir(dir, { recursive: true });

    if (file.path) {
      const src = path.resolve(file.path);
      const target = path.resolve(dest);
      if (src !== target) {
        await fs.rename(src, dest);
      }
    } else if (file.buffer) {
      await fs.writeFile(dest, file.buffer);
    } else {
      throw new BadRequestException('Không đọc được file upload');
    }

    const isMp3 = ext === '.mp3';
    const row = await this.prisma.musicTrack.update({
      where: { id: trackId },
      data: {
        originalFilePath: relative,
        mp3FilePath: isMp3 ? relative : null,
        mimeType: file.mimetype || 'audio/mpeg',
        fileSizeBytes: BigInt(file.size),
        conversionStatus: MusicTrackConversionStatus.READY,
      },
    });
    return row;
  }

  async uploadTrackAudio(id: string, file: Express.Multer.File) {
    await this.ensureTrack(id);
    const row = await this.persistAudioFile(id, file);
    return serializeTrack(row);
  }

  private async assertTrackAudioReady(
    trackId: string,
    options: { publicListen?: boolean; admin?: boolean },
  ) {
    const row = await this.ensureTrack(trackId);
    if (options.publicListen) {
      if (row.publicStatus !== MusicTrackPublicStatus.PUBLIC) {
        throw new NotFoundException('Ca khúc không công khai');
      }
    }
    const stored = playableRelativePath(row);
    if (!stored) {
      throw new NotFoundException('Chưa có file nhạc');
    }
    if (row.conversionStatus !== MusicTrackConversionStatus.READY) {
      throw new NotFoundException('File nhạc chưa sẵn sàng');
    }
    const mimeType = resolveTrackStreamMimeType(stored, row.mimeType);
    const fileName =
      fixUtf8Filename(
        `${row.songCode}-${row.songTitle}${path.extname(stored) || '.mp3'}`,
      ) || 'audio.mp3';
    return { row, stored, mimeType, fileName };
  }

  /** Stream có hỗ trợ Range — bắt buộc cho Safari/iOS và file lớn (.mov). */
  async writeTrackAudioHttpResponse(
    trackId: string,
    options: { publicListen?: boolean; admin?: boolean },
    req: Request,
    res: Response,
  ) {
    const { stored, mimeType, fileName } = await this.assertTrackAudioReady(
      trackId,
      options,
    );

    if (this.r2.isR2ObjectKey(stored)) {
      const { size } = await this.r2.headObject(stored);
      if (size < 1) {
        throw new NotFoundException('File nhạc không tồn tại trên R2');
      }
      await pipeTrackMediaWithRange(req, res, {
        mimeType,
        fileName,
        totalSize: size,
        openStream: (range) => this.r2.getObjectStream(stored, range),
      });
      return;
    }

    const abs = this.absoluteAudioPath(stored);
    if (!existsSync(abs)) {
      throw new NotFoundException('File nhạc không tồn tại trên máy chủ');
    }
    const totalSize = statSync(abs).size;
    await pipeTrackMediaWithRange(req, res, {
      mimeType,
      fileName,
      totalSize,
      openStream: (range) =>
        range
          ? createReadStream(abs, { start: range.start, end: range.end })
          : createReadStream(abs),
    });
  }

  async getTrackAudioStream(
    trackId: string,
    options: { publicListen?: boolean; admin?: boolean },
  ) {
    const { stored, mimeType, fileName } = await this.assertTrackAudioReady(
      trackId,
      options,
    );

    if (this.r2.isR2ObjectKey(stored)) {
      const stream = await this.r2.getObjectStream(stored);
      return { stream, mimeType, fileName };
    }

    const abs = this.absoluteAudioPath(stored);
    return {
      stream: createReadStream(abs),
      mimeType,
      fileName,
    };
  }

  /** Thư viện nghe công khai — đủ ca khúc (trừ HIDDEN), kể cả chưa có file READY. */
  private async fetchPublicCatalogTracks() {
    return this.prisma.musicTrack.findMany({
      where: {
        publicStatus: { not: MusicTrackPublicStatus.HIDDEN },
      },
      orderBy: [{ displayOrder: 'asc' }, { songCode: 'asc' }],
    });
  }

  /** Chỉ bài PUBLIC + file READY (legacy / kiểm tra). */
  private async fetchPublicReadyTracks() {
    const rows = await this.prisma.musicTrack.findMany({
      where: { publicStatus: MusicTrackPublicStatus.PUBLIC },
      orderBy: [{ displayOrder: 'asc' }, { songCode: 'asc' }],
    });
    return rows.filter(
      (r) =>
        playableRelativePath(r) != null &&
        r.conversionStatus === MusicTrackConversionStatus.READY,
    );
  }

  private mapTracksToBallotLinks(tracks: MusicTrack[]) {
    return tracks.map((track, displayOrder) => ({
      id: `catalog-${track.id}`,
      displayOrder,
      track: serializeTrack(track),
    }));
  }

  async listPublicTracks() {
    const rows = await this.fetchPublicCatalogTracks();
    return rows.map(serializeTrack);
  }

  /** Không có campaignId → toàn thư viện (chỉ nghe). Có campaignId → bài trong đợt (+ bình chọn). */
  async getPublicBallot(campaignId?: string) {
    const now = new Date();

    if (campaignId?.trim()) {
      const row = await this.prisma.votingCampaign.findUnique({
        where: { id: campaignId.trim() },
        include: {
          tracks: {
            orderBy: { displayOrder: 'asc' },
            include: { track: true },
          },
        },
      });
      if (!row) throw new NotFoundException('Không tìm thấy đợt bình chọn');
      return await this.formatPublicCampaignRow(row, now);
    }

    return this.buildCatalogBallot(null);
  }

  private async buildCatalogBallot(
    campaign: (VotingCampaign & { tracks: unknown[] }) | null,
  ) {
    const catalog = await this.fetchPublicCatalogTracks();
    const trackLinks = this.mapTracksToBallotLinks(catalog);
    const now = new Date();

    if (!campaign) {
      return {
        id: '',
        name: 'Thư viện ca khúc dự thi',
        description:
          'Toàn bộ ca khúc dự thi — nghe thử trước khi bình chọn trong đợt chính thức.',
        startAt: now.toISOString(),
        endAt: now.toISOString(),
        status: VotingCampaignStatus.DRAFT,
        maxTracksPerBallot: 0,
        tracks: trackLinks,
        votingOpen: false,
        statsVisible: false,
        catalogMode: true,
        showAllTracks: true,
        voterWhitelistRequired: false,
      };
    }

    const open =
      campaign.status === VotingCampaignStatus.ACTIVE &&
      now.getTime() >= campaign.startAt.getTime() &&
      now.getTime() <= campaign.endAt.getTime();

    return {
      ...serializeCampaign(campaign),
      tracks: trackLinks,
      votingOpen: open,
      statsVisible: canPublicSeeStats(campaign, now),
      catalogMode: true,
      showAllTracks: true,
      voterWhitelistRequired: false,
    };
  }

  private async formatPublicCampaignRow(
    row: VotingCampaign & {
      tracks: Array<{
        id: string;
        displayOrder: number;
        track: MusicTrack;
      }>;
    },
    now: Date,
  ) {
    const open =
      row.status === VotingCampaignStatus.ACTIVE &&
      now.getTime() >= row.startAt.getTime() &&
      now.getTime() <= row.endAt.getTime();

    const assigned = row.tracks.map((link) => ({
      id: link.id,
      displayOrder: link.displayOrder,
      track: serializeTrack(link.track),
    }));

    const voterWhitelistRequired = await this.isVoterWhitelistRequired(row.id);

    return {
      ...serializeCampaign(row),
      tracks: assigned,
      votingOpen: open && assigned.length > 0,
      statsVisible: canPublicSeeStats(row, now),
      catalogMode: false,
      showAllTracks: false,
      needsTrackAssignment: assigned.length === 0,
      voterWhitelistRequired,
    };
  }

  async importCampaignTracksBySongCodes(campaignId: string, songCodes: string[]) {
    await this.getCampaign(campaignId, false);
    const normalized = [
      ...new Set(
        songCodes.map((c) => c.trim()).filter((c) => c.length > 0),
      ),
    ];
    if (normalized.length === 0) {
      throw new BadRequestException('File Excel không có mã ca khúc hợp lệ');
    }

    const allTracks = await this.prisma.musicTrack.findMany({
      select: { id: true, songCode: true },
    });
    const byCode = new Map(
      allTracks.map((t) => [t.songCode.trim().toLowerCase(), t.id]),
    );

    const trackIds: string[] = [];
    const missing: string[] = [];
    for (const code of normalized) {
      const id = byCode.get(code.toLowerCase());
      if (id) trackIds.push(id);
      else missing.push(code);
    }

    if (trackIds.length === 0) {
      throw new BadRequestException(
        `Không khớp mã ca khúc nào trong hệ thống${missing.length ? `: ${missing.slice(0, 5).join(', ')}` : ''}`,
      );
    }

    await this.setCampaignTracks(campaignId, trackIds);

    return {
      ok: true,
      imported: trackIds.length,
      missingCodes: missing,
      trackIds,
    };
  }

  async listCampaignVoters(campaignId: string) {
    await this.getCampaign(campaignId, false);
    const rows = await this.prisma.votingCampaignVoter.findMany({
      where: { campaignId },
      orderBy: [{ employeeCode: 'asc' }],
      take: 2000,
    });
    return {
      campaignId,
      total: rows.length,
      voters: rows.map((r) => ({
        id: r.id,
        employeeCode: r.employeeCode,
        fullName: r.fullName,
        email: r.email,
        createdAt: r.createdAt,
      })),
    };
  }

  async clearCampaignVoters(campaignId: string) {
    await this.getCampaign(campaignId, false);
    const { count } = await this.prisma.votingCampaignVoter.deleteMany({
      where: { campaignId },
    });
    return { ok: true, removed: count };
  }

  async importCampaignVoters(
    campaignId: string,
    rows: Array<{ employeeCode: string; fullName?: string; email?: string }>,
  ) {
    await this.getCampaign(campaignId, false);

    const byEmail = new Map<
      string,
      { employeeCode: string; fullName: string | null; email: string }
    >();

    for (const row of rows) {
      const emailRaw = row.email?.trim();
      if (!emailRaw) continue;
      const email = normalizeEmail(emailRaw);
      const codeSource = row.employeeCode?.trim() || email.split('@')[0] || email;
      const employeeCode = normalizeEmployeeCode(codeSource);
      if (!employeeCode) continue;
      const fullName = row.fullName?.trim() || null;
      byEmail.set(email, { employeeCode, fullName, email });
    }

    const entries = [...byEmail.values()];
    if (entries.length === 0) {
      throw new BadRequestException(
        'File Excel không có email nhân viên hợp lệ (cột email)',
      );
    }

    const codes = entries.map((e) => e.employeeCode);
    const employees = await this.prisma.employee.findMany({
      where: {
        deletedAt: null,
        OR: codes.map((c) => ({
          code: { equals: c, mode: 'insensitive' },
        })),
      },
      select: { code: true, fullName: true },
    });
    const employeeNameByCode = new Map(
      employees.map((e) => [normalizeEmployeeCode(e.code), e.fullName]),
    );

    const missingInHr: string[] = [];
    const data = entries.map((entry) => {
      const fromHr = employeeNameByCode.get(entry.employeeCode);
      if (!fromHr) missingInHr.push(entry.employeeCode);
      return {
        campaignId,
        employeeCode: entry.employeeCode,
        email: entry.email,
        fullName: entry.fullName ?? fromHr ?? null,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.votingCampaignVoter.deleteMany({ where: { campaignId } });
      await tx.votingCampaignVoter.createMany({ data });
    });

    return {
      ok: true,
      imported: data.length,
      missingInEmployeeMaster: missingInHr,
    };
  }

  async verifyCampaignVoter(
    campaignId: string,
    dto: { email: string; fullName: string; trackId?: string },
  ) {
    const campaign = await this.prisma.votingCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt bình chọn');

    const required = await this.isVoterWhitelistRequired(campaignId);
    if (!required) {
      return { ok: true, whitelistOptional: true as const };
    }

    const row = await this.findWhitelistVoterByEmailAndName(
      campaignId,
      dto.email,
      dto.fullName,
    );
    if (!row) {
      return { ok: false as const, reason: 'not_in_whitelist' as const };
    }

    const existingVotes = await this.prisma.vote.findMany({
      where: {
        campaignId,
        employeeCode: row.employeeCode,
        status: VoteRecordStatus.VALID,
      },
      select: { trackId: true },
    });
    const votedTrackIds = existingVotes.map((v) => v.trackId);
    const max = campaign.maxTracksPerBallot;
    const votesUsed = votedTrackIds.length;
    const trackAlreadyVoted =
      dto.trackId != null && votedTrackIds.includes(dto.trackId);

    return {
      ok: true as const,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      votesUsed,
      maxTracksPerBallot: max,
      votesRemaining: max > 0 ? Math.max(0, max - votesUsed) : null,
      trackAlreadyVoted,
      votedTrackIds,
    };
  }

  private resolvePublicTrackLinks(
    row: VotingCampaign & {
      tracks: Array<{
        id: string;
        displayOrder: number;
        track: MusicTrack;
      }>;
    },
  ) {
    return {
      links: row.tracks.map((link) => ({
        id: link.id,
        displayOrder: link.displayOrder,
        track: serializeTrack(link.track),
      })),
      showAllTracks: false,
      needsTrackAssignment: row.tracks.length === 0,
    };
  }

  async setCampaignTracks(campaignId: string, trackIds: string[]) {
    await this.getCampaign(campaignId, false);
    const unique = [...new Set(trackIds)];
    if (unique.length > 0) {
      const found = await this.prisma.musicTrack.findMany({
        where: { id: { in: unique } },
        select: { id: true },
      });
      if (found.length !== unique.length) {
        throw new BadRequestException('Một hoặc nhiều ca khúc không tồn tại');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.votingCampaignTrack.deleteMany({ where: { campaignId } });
      if (unique.length === 0) return;
      await tx.votingCampaignTrack.createMany({
        data: unique.map((trackId, index) => ({
          campaignId,
          trackId,
          displayOrder: index,
        })),
      });
    });

    return this.getCampaign(campaignId, true);
  }

  async listCampaigns() {
    const rows = await this.prisma.votingCampaign.findMany({
      orderBy: [{ startAt: 'desc' }],
      include: {
        _count: { select: { tracks: true, votes: true, voters: true } },
      },
    });
    return rows.map((r) => ({
      ...serializeCampaign(r),
      trackCount: r._count.tracks,
      voteCount: r._count.votes,
      voterWhitelistCount: r._count.voters,
    }));
  }

  async getCampaign(id: string, includeTracks = true) {
    if (!includeTracks) {
      const row = await this.prisma.votingCampaign.findUnique({
        where: { id },
      });
      if (!row) throw new NotFoundException('Không tìm thấy đợt bình chọn');
      return serializeCampaign(row);
    }
    const row = await this.prisma.votingCampaign.findUnique({
      where: { id },
      include: {
        tracks: {
          orderBy: { displayOrder: 'asc' },
          include: { track: true },
        },
        _count: { select: { voters: true } },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy đợt bình chọn');
    return {
      ...serializeCampaign(row),
      voterWhitelistCount: row._count.voters,
      tracks: row.tracks.map((link) => ({
        id: link.id,
        displayOrder: link.displayOrder,
        track: serializeTrack(link.track),
      })),
    };
  }

  async createCampaign(dto: CreateVotingCampaignDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('endAt phải sau startAt');
    }
    const row = await this.prisma.votingCampaign.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        startAt,
        endAt,
        status: dto.status ?? VotingCampaignStatus.DRAFT,
        maxTracksPerBallot: dto.maxTracksPerBallot ?? 0,
        resultPublishConfig:
          dto.resultPublishConfig === undefined
            ? undefined
            : (dto.resultPublishConfig as Prisma.InputJsonValue),
      },
    });
    return serializeCampaign(row);
  }

  async updateCampaign(id: string, dto: UpdateVotingCampaignDto) {
    await this.getCampaign(id, false);
    const startAt = dto.startAt ? new Date(dto.startAt) : undefined;
    const endAt = dto.endAt ? new Date(dto.endAt) : undefined;
    if (startAt && endAt && endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('endAt phải sau startAt');
    }
    const row = await this.prisma.votingCampaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(startAt ? { startAt } : {}),
        ...(endAt ? { endAt } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.maxTracksPerBallot !== undefined
          ? { maxTracksPerBallot: dto.maxTracksPerBallot }
          : {}),
        ...(dto.resultPublishConfig !== undefined
          ? {
              resultPublishConfig:
                dto.resultPublishConfig as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
    return serializeCampaign(row);
  }

  async removeCampaign(id: string) {
    await this.getCampaign(id, false);
    await this.prisma.votingCampaign.delete({ where: { id } });
    return { ok: true, id };
  }

  async addCampaignTrack(campaignId: string, dto: AddCampaignTrackDto) {
    await this.getCampaign(campaignId, false);
    await this.ensureTrack(dto.trackId);
    try {
      return await this.prisma.votingCampaignTrack.create({
        data: {
          campaignId,
          trackId: dto.trackId,
          displayOrder: dto.displayOrder ?? 0,
        },
        include: { track: true },
      });
    } catch (err) {
      if (this.isUnique(err)) {
        throw new ConflictException('Ca khúc đã có trong đợt bình chọn');
      }
      throw err;
    }
  }

  async removeCampaignTrack(campaignId: string, linkId: string) {
    const link = await this.prisma.votingCampaignTrack.findFirst({
      where: { id: linkId, campaignId },
    });
    if (!link) throw new NotFoundException('Không tìm thấy liên kết đợt–ca khúc');
    await this.prisma.votingCampaignTrack.delete({ where: { id: linkId } });
    return { ok: true };
  }

  async getCampaignStats(campaignId: string, options?: { publicView?: boolean }) {
    const campaign = await this.prisma.votingCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt bình chọn');

    const now = new Date();
    if (options?.publicView && !canPublicSeeStats(campaign, now)) {
      throw new BadRequestException('Kết quả chưa được công bố');
    }

    const links = await this.prisma.votingCampaignTrack.findMany({
      where: { campaignId },
      include: { track: true },
      orderBy: { displayOrder: 'asc' },
    });

    const grouped = await this.prisma.vote.groupBy({
      by: ['trackId'],
      where: { campaignId, status: VoteRecordStatus.VALID },
      _count: { id: true },
    });
    const countByTrack = new Map(
      grouped.map((g) => [g.trackId, g._count.id]),
    );

    const byTrack = links.map((link) => ({
      trackId: link.trackId,
      songCode: link.track.songCode,
      songTitle: link.track.songTitle,
      performerName: link.track.performerName,
      voteCount: countByTrack.get(link.trackId) ?? 0,
    }));

    byTrack.sort((a, b) => b.voteCount - a.voteCount);

    const totalVotes = byTrack.reduce((s, r) => s + r.voteCount, 0);

    return {
      campaignId,
      totalVotes,
      computedAt: now.toISOString(),
      rows: byTrack,
    };
  }

  async getPublicCampaign(campaignId: string) {
    const row = await this.prisma.votingCampaign.findUnique({
      where: { id: campaignId },
      include: {
        tracks: {
          orderBy: { displayOrder: 'asc' },
          include: { track: true },
        },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy đợt bình chọn');
    const now = new Date();
    const open =
      row.status === VotingCampaignStatus.ACTIVE &&
      now.getTime() >= row.startAt.getTime() &&
      now.getTime() <= row.endAt.getTime();

    const { links, showAllTracks, needsTrackAssignment } =
      this.resolvePublicTrackLinks(row);

    const voterWhitelistRequired = await this.isVoterWhitelistRequired(
      campaignId,
    );

    return {
      ...serializeCampaign(row),
      tracks: links,
      votingOpen: open && links.length > 0,
      statsVisible: canPublicSeeStats(row, now),
      catalogMode: false,
      showAllTracks,
      needsTrackAssignment,
      voterWhitelistRequired,
    };
  }

  async submitVote(
    campaignId: string,
    dto: SubmitVoteDto,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const campaign = await this.prisma.votingCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt bình chọn');

    const now = new Date();
    if (campaign.status !== VotingCampaignStatus.ACTIVE) {
      throw new BadRequestException('Đợt bình chọn không ở trạng thái ACTIVE');
    }
    if (
      now.getTime() < campaign.startAt.getTime() ||
      now.getTime() > campaign.endAt.getTime()
    ) {
      throw new BadRequestException('Ngoài thời gian bình chọn');
    }

    const uniqueTrackIds = [...new Set(dto.trackIds)];
    if (uniqueTrackIds.length !== dto.trackIds.length) {
      throw new BadRequestException('trackIds trùng lặp');
    }

    const max = campaign.maxTracksPerBallot;
    if (max > 0 && uniqueTrackIds.length > max) {
      throw new BadRequestException(
        `Chỉ được chọn tối đa ${max} ca khúc / lượt`,
      );
    }

    const links = await this.prisma.votingCampaignTrack.findMany({
      where: { campaignId, trackId: { in: uniqueTrackIds } },
    });
    if (links.length !== uniqueTrackIds.length) {
      throw new BadRequestException(
        'Một hoặc nhiều ca khúc không thuộc đợt bình chọn',
      );
    }

    const voterKey = dto.voterKey.trim();
    const whitelistRequired = await this.isVoterWhitelistRequired(campaignId);
    let employeeCodeStored: string | null = null;

    if (whitelistRequired) {
      const email = dto.email?.trim();
      const fullName = dto.fullName?.trim();
      if (!email || !fullName) {
        throw new BadRequestException(
          'Nhập đúng email và họ tên nhân viên để bình chọn',
        );
      }
      const allowed = await this.findWhitelistVoterByEmailAndName(
        campaignId,
        email,
        fullName,
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Email hoặc họ tên không khớp danh sách được bình chọn',
        );
      }
      employeeCodeStored = allowed.employeeCode;

      const existingVotes = await this.prisma.vote.findMany({
        where: {
          campaignId,
          employeeCode: employeeCodeStored,
          status: VoteRecordStatus.VALID,
        },
        select: { trackId: true },
      });
      const votedSet = new Set(existingVotes.map((v) => v.trackId));
      for (const trackId of uniqueTrackIds) {
        if (votedSet.has(trackId)) {
          throw new ConflictException('Bạn đã bình chọn ca khúc này');
        }
      }
      const totalAfter = votedSet.size + uniqueTrackIds.length;
      if (max > 0 && totalAfter > max) {
        throw new BadRequestException(
          `Chỉ được bình chọn tối đa ${max} ca khúc trong đợt này`,
        );
      }
    } else {
      const existing = await this.prisma.vote.findFirst({
        where: { campaignId, voterKey, status: VoteRecordStatus.VALID },
      });
      if (existing) {
        throw new ConflictException('Phiên này đã bình chọn');
      }
    }

    await this.prisma.vote.createMany({
      data: uniqueTrackIds.map((trackId) => ({
        campaignId,
        trackId,
        voterKey,
        employeeCode: employeeCodeStored,
        status: VoteRecordStatus.VALID,
        ipAddress: meta.ipAddress?.slice(0, 64) || null,
        userAgent: meta.userAgent?.slice(0, 512) || null,
      })),
    });

    return {
      ok: true,
      acceptedTrackIds: uniqueTrackIds,
    };
  }

  private async ensureTrack(id: string) {
    const row = await this.prisma.musicTrack.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy ca khúc');
    return row;
  }
}
