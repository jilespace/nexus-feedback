import crypto from 'node:crypto';
import { prisma } from '../db/client.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { paginatedResult } from '../utils/pagination.js';
import { assertSafeWebhookUrl } from '../utils/urlGuard.js';

export async function createWebhook(
  orgId: string,
  projectId: string,
  url: string,
  events: string[],
  secret?: string,
) {
  if (!url) throw new ValidationError('URL 不能为空');
  if (!events.length) throw new ValidationError('事件列表不能为空');

  // SSRF defense-in-depth: validate URL even if route layer already checked
  await assertSafeWebhookUrl(url);

  const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

  const webhook = await prisma.webhook.create({
    data: {
      url,
      events,
      secret: webhookSecret,
      project_id: projectId,
    },
  });

  return webhook;
}

export async function listWebhooks(
  projectId: string,
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const [items, total] = await Promise.all([
    prisma.webhook.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
    }),
    prisma.webhook.count({ where: { project_id: projectId } }),
  ]);

  return paginatedResult(items, total, pagination?.page ?? 1, pagination?.pageSize ?? 20);
}

async function findOrgWebhook(orgId: string, projectId: string, id: string) {
  const webhook = await prisma.webhook.findFirst({
    where: { id, project_id: projectId, project: { org_id: orgId } },
  });
  if (!webhook) throw new NotFoundError('Webhook 不存在');
  return webhook;
}

export async function updateWebhook(
  orgId: string,
  projectId: string,
  id: string,
  data: { url?: string; events?: string[]; active?: boolean },
) {
  await findOrgWebhook(orgId, projectId, id);

  return prisma.webhook.update({
    where: { id },
    data,
  });
}

export async function deleteWebhook(orgId: string, projectId: string, id: string) {
  await findOrgWebhook(orgId, projectId, id);

  await prisma.webhook.delete({ where: { id } });
  return { id };
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

async function deliverWebhook(
  webhook: { id: string; url: string; secret: string },
  body: string,
  event: string,
): Promise<void> {
  const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');

  try {
    await assertSafeWebhookUrl(webhook.url);
  } catch {
    return; // URL became unsafe after storage (e.g. DNS rebinding) — skip delivery
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });

      await prisma.webhookLog.create({
        data: {
          webhook_id: webhook.id,
          event,
          payload: body,
          status_code: res.status,
          success: res.ok,
          attempts: attempt + 1,
        },
      });

      if (res.ok) return;
      if (res.status < 500) return;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      if (attempt === MAX_RETRIES) {
        await prisma.webhookLog.create({
          data: {
            webhook_id: webhook.id,
            event,
            payload: body,
            success: false,
            attempts: attempt + 1,
            error,
          },
        });
        return;
      }
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
}

export async function fireWebhooks(
  projectId: string,
  event: string,
  payload: unknown,
) {
  const webhooks = await prisma.webhook.findMany({
    where: {
      project_id: projectId,
      active: true,
      events: { has: event },
    },
  });

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

  for (const webhook of webhooks) {
    deliverWebhook(webhook, body, event).catch(() => {});
  }
}

export async function listWebhookLogs(
  webhookId: string,
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const where = { webhook_id: webhookId };
  const [items, total] = await Promise.all([
    prisma.webhookLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
    }),
    prisma.webhookLog.count({ where }),
  ]);
  return paginatedResult(items, total, pagination?.page ?? 1, pagination?.pageSize ?? 20);
}

export async function sendTestWebhook(orgId: string, projectId: string, id: string) {
  const webhook = await findOrgWebhook(orgId, projectId, id);
  await assertSafeWebhookUrl(webhook.url);

  const payload = {
    event: 'test',
    data: { message: 'This is a test webhook delivery' },
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(body)
    .digest('hex');

  const res = await fetch(webhook.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body,
    redirect: 'error',
  });

  return { ok: res.ok };
}
