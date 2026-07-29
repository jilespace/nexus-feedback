import { Resend } from 'resend';
import { env } from '../config/index.js';
import { getEmailConfig } from './systemConfig.js';

let resend: Resend | null = null;
let cachedApiKey: string | null = null;

async function getClient(): Promise<Resend | null> {
  const config = await getEmailConfig();
  const apiKey = config.apiKey || env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resend || cachedApiKey !== apiKey) {
    resend = new Resend(apiKey);
    cachedApiKey = apiKey;
  }
  return resend;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const client = await getClient();
  if (!client) {
    console.log(JSON.stringify({ level: 'info', msg: 'Email skipped (no RESEND_API_KEY)', to, subject }));
    return;
  }
  const config = await getEmailConfig();
  const fromEmail = config.fromEmail || env.RESEND_FROM_EMAIL;
  await client.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
  });
}

export async function sendBatchEmails(recipients: string[], subject: string, html: string): Promise<void> {
  const client = await getClient();
  if (!client) {
    console.log(JSON.stringify({ level: 'info', msg: 'Batch email skipped (no RESEND_API_KEY)', count: recipients.length }));
    return;
  }
  const config = await getEmailConfig();
  const fromEmail = config.fromEmail || env.RESEND_FROM_EMAIL;
  const batch = recipients.map((to) => ({
    from: fromEmail,
    to,
    subject,
    html,
  }));
  await client.batch.send(batch);
}
