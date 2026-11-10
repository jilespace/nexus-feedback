import { describe, it, expect } from 'vitest';
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  UNSUBSCRIBE_TOKEN_TTL_SECONDS,
  type UnsubscribePayload,
} from '../unsubscribeToken.js';

const payload: UnsubscribePayload = {
  email: 'fan@example.com',
  project_id: 'proj_1',
  type: 'weekly_digest',
};

function tamperLastChar(value: string): string {
  const last = value.at(-1) ?? 'a';
  return value.slice(0, -1) + (last === 'a' ? 'b' : 'a');
}

describe('unsubscribeToken', () => {
  it('signs and verifies a payload round-trip', () => {
    const token = signUnsubscribeToken(payload);
    const result = verifyUnsubscribeToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.payload).toEqual(payload);
  });

  it('defaults to a 30 day validity window', () => {
    expect(UNSUBSCRIBE_TOKEN_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it('rejects a tampered signature', () => {
    const token = signUnsubscribeToken(payload);
    const [encoded, expiresAt, signature] = token.split('.');
    const tampered = `${encoded}.${expiresAt}.${tamperLastChar(signature ?? '')}`;
    const result = verifyUnsubscribeToken(tampered);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('invalid');
  });

  it('rejects a tampered payload', () => {
    const token = signUnsubscribeToken(payload);
    const [encoded, expiresAt, signature] = token.split('.');
    const tampered = `${tamperLastChar(encoded ?? '')}.${expiresAt}.${signature}`;
    const result = verifyUnsubscribeToken(tampered);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('invalid');
  });

  it('reports expired tokens', () => {
    const token = signUnsubscribeToken(payload, { ttlSeconds: -10 });
    const result = verifyUnsubscribeToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('expired');
  });

  it('rejects malformed tokens', () => {
    for (const token of ['', 'abc', 'a.b', 'a.b.c', '...', '%%%.123.abc']) {
      const result = verifyUnsubscribeToken(token);
      expect(result.valid).toBe(false);
    }
  });

  it('rejects an unknown subscription type', () => {
    const token = signUnsubscribeToken({
      ...payload,
      type: 'daily_push' as never,
    });
    expect(verifyUnsubscribeToken(token).valid).toBe(false);
  });
});
