import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少需要 32 个字符'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:8080,http://localhost:8081,http://localhost:5173'),
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024),
  ALLOWED_FILE_TYPES: z.string().default('image/png,image/jpeg,image/gif,image/webp,application/pdf'),
  STORAGE_TYPE: z.enum(['local', 's3', 'oss', 'qiniu']).default('local'),
  LOCAL_UPLOAD_DIR: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('notifications@nexus-feedback.dev'),
  BASE_URL: z.string().default('http://localhost:8080'),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
