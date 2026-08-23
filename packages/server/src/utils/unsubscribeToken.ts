import crypto from 'node:crypto';
import { env } from '../config/index.js';

export function generateUnsubscribeToken(email: string, projectId: string): string {
  const payload = `${email}|${projectId}`;
  return crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');
}

export function verifyUnsubscribeToken(email: string, projectId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email, projectId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
