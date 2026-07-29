import { prisma } from '../db/client.js';
import { env } from '../config/index.js';

export async function getConfig(key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getAllConfigs(): Promise<Record<string, string>> {
  const rows = await prisma.systemConfig.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

export async function getConfigOrEnv(key: string, envKey: string): Promise<string | undefined> {
  const dbVal = await getConfig(key);
  if (dbVal) return dbVal;
  return (env as Record<string, unknown>)[envKey] as string | undefined;
}

export async function getStorageConfig() {
  const configs = await getAllConfigs();
  return {
    type: configs['storage_type'] || env.STORAGE_TYPE || 'local',
    bucket: configs['storage_bucket'] || env.S3_BUCKET || '',
    region: configs['storage_region'] || env.S3_REGION || 'us-east-1',
    endpoint: configs['storage_endpoint'] || env.S3_ENDPOINT || '',
    accessKey: configs['storage_access_key'] || env.S3_ACCESS_KEY || '',
    secretKey: configs['storage_secret_key'] || env.S3_SECRET_KEY || '',
    domain: configs['storage_domain'] || '',
  };
}

export async function getEmailConfig() {
  const configs = await getAllConfigs();
  return {
    apiKey: configs['email_api_key'] || env.RESEND_API_KEY || '',
    fromEmail: configs['email_from'] || env.RESEND_FROM_EMAIL || '',
  };
}
