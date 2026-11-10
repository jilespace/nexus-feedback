import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/index.js';

export type UnsubscribeTopic = 'status_updates' | 'weekly_digest' | 'all';

export interface UnsubscribePayload {
  email: string;
  project_id: string;
  type: UnsubscribeTopic;
}

export type UnsubscribeTokenVerifyResult =
  | { valid: true; payload: UnsubscribePayload }
  | { valid: false; reason: 'invalid' | 'expired' };

/** 30 days, matching the confirmation email copy. */
export const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const PAYLOAD_SEPARATOR = '|';
const TOPICS: readonly UnsubscribeTopic[] = [
  'status_updates',
  'weekly_digest',
  'all',
];

function isUnsubscribeTopic(value: string): value is UnsubscribeTopic {
  return (TOPICS as readonly string[]).includes(value);
}

function signatureFor(encodedPayload: string, expiresAt: number): string {
  return createHmac('sha256', env.JWT_SECRET)
    .update(`${encodedPayload}.${expiresAt}`)
    .digest('base64url');
}

export interface SignUnsubscribeTokenOptions {
  ttlSeconds?: number;
  /** Override the issue time (ms since epoch); used by tests. */
  now?: number;
}

/**
 * Sign a stateless unsubscribe token: `base64url(email|project_id|type)`
 * followed by the expiry (epoch seconds) and an HMAC-SHA256 signature.
 */
export function signUnsubscribeToken(
  payload: UnsubscribePayload,
  options: SignUnsubscribeTokenOptions = {},
): string {
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const expiresAt = nowSeconds + (options.ttlSeconds ?? UNSUBSCRIBE_TOKEN_TTL_SECONDS);
  const encodedPayload = Buffer.from(
    [payload.email, payload.project_id, payload.type].join(PAYLOAD_SEPARATOR),
    'utf8',
  ).toString('base64url');
  const signature = signatureFor(encodedPayload, expiresAt);
  return `${encodedPayload}.${expiresAt}.${signature}`;
}

/** Verify signature and expiry; returns the signed payload on success. */
export function verifyUnsubscribeToken(
  token: string,
): UnsubscribeTokenVerifyResult {
  if (typeof token !== 'string' || !token) {
    return { valid: false, reason: 'invalid' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'invalid' };
  const [encodedPayload, expiresAtRaw, signature] = parts;
  if (!encodedPayload || !expiresAtRaw || !signature) {
    return { valid: false, reason: 'invalid' };
  }
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    return { valid: false, reason: 'invalid' };
  }

  const expected = signatureFor(encodedPayload, expiresAt);
  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: 'invalid' };
  }

  if (Math.floor(Date.now() / 1000) > expiresAt) {
    return { valid: false, reason: 'expired' };
  }

  const raw = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  const [email, projectId, type] = raw.split(PAYLOAD_SEPARATOR);
  if (!email || !projectId || !type || !isUnsubscribeTopic(type)) {
    return { valid: false, reason: 'invalid' };
  }
  return {
    valid: true,
    payload: { email, project_id: projectId, type },
  };
}
