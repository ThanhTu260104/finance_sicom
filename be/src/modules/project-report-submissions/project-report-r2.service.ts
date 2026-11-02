import {
  CopyObjectCommand,
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
const PRESIGN_DOWNLOAD_SECONDS = 900;

@Injectable()
export class ProjectReportR2Service {
  private readonly client: S3Client | null;
  private readonly bucket: string | null;
  private readonly keyPrefix: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('R2_ENDPOINT')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config
      .get<string>('R2_SECRET_ACCESS_KEY')
      ?.trim();
    this.bucket = this.config.get<string>('R2_BUCKET_NAME')?.trim() ?? null;

    const prefix = this.config.get<string>('R2_KEY_PREFIX')?.trim() ?? 'Report/';
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
      this.config.get<string>('PROJECT_REPORT_UPLOAD_DRIVER')?.trim() ??
      'auto';
    if (driver === 'local') return false;
    if (!this.client || !this.bucket) return false;
    if (driver === 'r2') return true;
    return true;
  }

  stagedObjectKey(stagedId: string, storedName: string) {
    return `${this.keyPrefix}staged/${stagedId}/${storedName}`;
  }

  submissionObjectKey(submissionId: string, storedName: string) {
    return `${this.keyPrefix}submissions/${submissionId}/${storedName}`;
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
    const size = out.ContentLength ?? 0;
    return { size };
  }

  async copyObject(sourceKey: string, destKey: string) {
    this.assertReady();
    await this.client!.send(
      new CopyObjectCommand({
        Bucket: this.bucket!,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destKey,
      }),
    );
  }

  async deleteObject(objectKey: string) {
    this.assertReady();
    await this.client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket!, Key: objectKey }),
    );
  }

  async getObjectStream(objectKey: string) {
    this.assertReady();
    const out = await this.client!.send(
      new GetObjectCommand({ Bucket: this.bucket!, Key: objectKey }),
    );
    if (!out.Body) {
      throw new Error('Empty R2 object body');
    }
    return out.Body as Readable;
  }

  private assertReady() {
    if (!this.client || !this.bucket) {
      throw new Error('R2 is not configured');
    }
  }
}
