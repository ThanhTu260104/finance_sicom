import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';

const PRESIGN_UPLOAD_SECONDS = 3600;

@Injectable()
export class MusicTrackR2Service {
  private readonly client: S3Client | null;
  private readonly bucket: string | null;
  readonly keyPrefix: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('R2_ENDPOINT')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config
      .get<string>('R2_SECRET_ACCESS_KEY')
      ?.trim();
    this.bucket = this.config.get<string>('R2_BUCKET_NAME')?.trim() ?? null;

    const prefix =
      this.config.get<string>('MUSIC_R2_KEY_PREFIX')?.trim() ??
      'Music/tracks/';
    this.keyPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;

    if (endpoint && accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.client = null;
    }
  }

  isActive(): boolean {
    const driver =
      this.config.get<string>('MUSIC_UPLOAD_DRIVER')?.trim() ?? 'auto';
    if (driver === 'local') return false;
    if (!this.client || !this.bucket) return false;
    if (driver === 'r2') return true;
    return true;
  }

  isR2ObjectKey(storedPath: string | null | undefined): boolean {
    if (!storedPath?.trim()) return false;
    return storedPath.startsWith(this.keyPrefix);
  }

  trackObjectKey(trackId: string, fileName: string) {
    return `${this.keyPrefix}${trackId}/${fileName}`;
  }

  async presignedPutUrl(
    objectKey: string,
    contentType: string,
    contentLength: number,
  ) {
    this.assertReady();
    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(this.client!, command, {
      expiresIn: PRESIGN_UPLOAD_SECONDS,
    });
  }

  async headObject(objectKey: string) {
    this.assertReady();
    const out = await this.client!.send(
      new HeadObjectCommand({ Bucket: this.bucket!, Key: objectKey }),
    );
    return { size: out.ContentLength ?? 0, contentType: out.ContentType };
  }

  async getObjectStream(
    objectKey: string,
    range?: { start: number; end: number },
  ) {
    this.assertReady();
    const out = await this.client!.send(
      new GetObjectCommand({
        Bucket: this.bucket!,
        Key: objectKey,
        ...(range
          ? { Range: `bytes=${range.start}-${range.end}` }
          : {}),
      }),
    );
    if (!out.Body) {
      throw new Error('Empty R2 object body');
    }
    return out.Body as Readable;
  }

  async deleteObject(objectKey: string) {
    if (!this.client || !this.bucket) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket!, Key: objectKey }),
    );
  }

  private assertReady() {
    if (!this.client || !this.bucket) {
      throw new Error('R2 is not configured');
    }
  }
}
