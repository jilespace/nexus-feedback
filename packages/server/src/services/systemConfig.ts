import { prisma } from '../db/client.js';
import { env } from '../config/index.js';

export async function getConfig(orgId: string, key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({
    where: { org_id_key: { org_id: orgId, key } },
  });
  return row?.value ?? null;
}

export async function setConfig(orgId: string, key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { org_id_key: { org_id: orgId, key } },
    update: { value },
    create: { org_id: orgId, key, value },
  });
}

export async function getAllConfigs(orgId: string): Promise<Record<string, string>> {
  const rows = await prisma.systemConfig.findMany({ where: { org_id: orgId } });
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

export async function getStorageConfig(orgId: string) {
  const configs = await getAllConfigs(orgId);
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

export async function getEmailConfig(orgId: string) {
  const configs = await getAllConfigs(orgId);
  return {
    apiKey: configs['email_api_key'] || env.RESEND_API_KEY || '',
    fromEmail: configs['email_from'] || env.RESEND_FROM_EMAIL || '',
  };
}
