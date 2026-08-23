import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import qiniu from 'qiniu';
import { env } from '../config/index.js';
import { getStorageConfig } from './systemConfig.js';

export type UploadResult = {
  key: string;
  url: string;
};

export type StorageAdapter = {
  upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
  getUrl(key: string): string | Promise<string>;
  delete(key: string): Promise<void>;
};

export class LocalStorageAdapter implements StorageAdapter {
  private dir: string;

  constructor(dir = env.LOCAL_UPLOAD_DIR) {
    this.dir = dir;
  }

  async upload(file: Buffer, filename: string, _mimeType: string): Promise<UploadResult> {
    await fs.mkdir(this.dir, { recursive: true });
    const ext = path.extname(filename);
    const key = `${crypto.randomUUID()}${ext}`;
    const filepath = path.join(this.dir, key);
    await fs.writeFile(filepath, file);
    return { key, url: `/uploads/${key}` };
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filepath = path.join(this.dir, key);
    await fs.unlink(filepath).catch(() => {});
  }
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!env.S3_BUCKET) {
      throw new Error('S3_BUCKET 环境变量未配置');
    }
    this.bucket = env.S3_BUCKET;

    this.client = new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT, forcePathStyle: true }),
      ...(env.S3_ACCESS_KEY && env.S3_SECRET_KEY && {
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY,
          secretAccessKey: env.S3_SECRET_KEY,
        },
      }),
    });
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const ext = path.extname(filename);
    const key = `${crypto.randomUUID()}${ext}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: mimeType,
    }));

    const url = await this.getUrl(key);
    return { key, url };
  }

  async getUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }
}

export class QiniuStorageAdapter implements StorageAdapter {
  private bucket: string;
  private accessKey: string;
  private secretKey: string;
  private domain: string;

  constructor(config: { bucket: string; accessKey: string; secretKey: string; domain: string }) {
    this.bucket = config.bucket;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.domain = config.domain;
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const ext = path.extname(filename);
    const key = `${crypto.randomUUID()}${ext}`;

    const mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
    const putPolicy = new qiniu.rs.PutPolicy({ scope: `${this.bucket}:${key}` });
    const uploadToken = putPolicy.uploadToken(mac);

    const formUploader = new qiniu.form_up.FormUploader(new qiniu.conf.Config());
    const putExtra = new qiniu.form_up.PutExtra();
    putExtra.mimeType = mimeType;

    await new Promise<void>((resolve, reject) => {
      formUploader.put(uploadToken, key, file, putExtra, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const url = `https://${this.domain}/${key}`;
    return { key, url };
  }

  getUrl(key: string): string {
    return `https://${this.domain}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
    const config = new qiniu.conf.Config();
    const bucketManager = new qiniu.rs.BucketManager(mac, config);

    await new Promise<void>((resolve, reject) => {
      bucketManager.delete(this.bucket, key, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export async function createStorageAdapterFromConfig(orgId?: string): Promise<StorageAdapter> {
  const config = await getStorageConfig(orgId ?? '');
  switch (config.type) {
    case 'qiniu':
      return new QiniuStorageAdapter({
        bucket: config.bucket,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
        domain: config.domain,
      });
    case 's3':
    case 'oss':
      return new S3StorageAdapter();
    case 'local':
    default:
      return new LocalStorageAdapter();
  }
}

export function createStorageAdapter(): StorageAdapter {
  switch (env.STORAGE_TYPE) {
    case 's3':
    case 'oss':
      return new S3StorageAdapter();
    case 'local':
    default:
      return new LocalStorageAdapter();
  }
}
