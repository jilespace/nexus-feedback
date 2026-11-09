import { Resend } from 'resend';
import { env } from '../config/index.js';
import { getEmailConfig } from './systemConfig.js';

let resend: Resend | null = null;
let cachedApiKey: string | null = null;

async function getClient(orgId?: string): Promise<Resend | null> {
  const config = await getEmailConfig(orgId ?? '');
  const apiKey = config.apiKey || env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resend || cachedApiKey !== apiKey) {
    resend = new Resend(apiKey);
    cachedApiKey = apiKey;
  }
  return resend;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  orgId?: string,
): Promise<void> {
  const client = await getClient(orgId);
  if (!client) {
    throw new Error('邮件未配置：请在「系统配置」中设置 Resend API Key');
  }
  const config = await getEmailConfig(orgId ?? '');
  const fromEmail = config.fromEmail || env.RESEND_FROM_EMAIL;
  const { data, error } = await client.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(`邮件发送失败: ${error.message || error.name || JSON.stringify(error)}`);
  }
  console.log(JSON.stringify({ level: 'info', msg: 'Email sent', id: data?.id, to, subject }));
}

export async function sendBatchEmails(
  recipients: string[],
  subject: string,
  html: string,
  orgId?: string,
): Promise<void> {
  const client = await getClient(orgId);
  if (!client) {
    throw new Error('邮件未配置：请在「系统配置」中设置 Resend API Key');
  }
  const config = await getEmailConfig(orgId ?? '');
  const fromEmail = config.fromEmail || env.RESEND_FROM_EMAIL;
  const batch = recipients.map((to) => ({
    from: fromEmail,
    to,
    subject,
    html,
  }));
  const { error } = await client.batch.send(batch);
  if (error) {
    throw new Error(`批量邮件发送失败: ${error.message || error.name || JSON.stringify(error)}`);
  }
  console.log(JSON.stringify({ level: 'info', msg: 'Batch emails sent', count: recipients.length }));
}
