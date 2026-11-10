import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../../utils/unsubscribeToken.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    project: { findFirst: vi.fn(), findUnique: vi.fn() },
    notificationPreference: { upsert: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}));

vi.mock('../../services/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendBatchEmails: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../db/client.js';
import { sendEmail } from '../../services/email.js';

const project = {
  id: 'proj_1',
  slug: 'test',
  name: 'Test Project',
  org_id: 'org_1',
};

const payload = {
  email: 'fan@example.com',
  project_id: 'proj_1',
  type: 'weekly_digest' as const,
};

const sendEmailMock = vi.mocked(sendEmail);

describe('subscription confirmation email + unsubscribe token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmailMock.mockResolvedValue(undefined);
    vi.mocked(prisma.project.findFirst).mockResolvedValue(project as never);
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValue({
      id: 'pref_1',
    } as never);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      board_url: null,
    } as never);
  });

  it('sends a confirmation email with a signed unsubscribe link after subscribing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/public/test/subscribe')
      .send({ email: 'fan@example.com', type: 'weekly_digest' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      subscribed: true,
      type: 'weekly_digest',
    });

    await vi.waitFor(() => expect(sendEmailMock).toHaveBeenCalledTimes(1));
    const [to, subject, html, orgId] = sendEmailMock.mock.calls[0]!;
    expect(to).toBe('fan@example.com');
    expect(subject).toContain('Test Project');
    expect(orgId).toBe('org_1');
    expect(html).toContain('订阅成功');
    expect(html).toContain('/test/unsubscribe?token=');

    const token = html!.match(/token=([^"&<\s]+)/)?.[1] ?? '';
    expect(token).not.toBe('');
    const verified = verifyUnsubscribeToken(decodeURIComponent(token));
    expect(verified.valid).toBe(true);
    if (verified.valid) expect(verified.payload).toEqual(payload);
  });

  it('keeps the subscription successful when the email fails', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('email not configured'));
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/public/test/subscribe')
      .send({ email: 'fan@example.com', type: 'all' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ subscribed: true, type: 'all' });
    await vi.waitFor(() => expect(sendEmailMock).toHaveBeenCalled());
  });

  it('returns the payload for a valid unsubscribe token', async () => {
    const token = signUnsubscribeToken(payload);
    const app = createApp();
    const res = await request(app).get(
      `/api/v1/public/test/unsubscribe-token?token=${encodeURIComponent(token)}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(payload);
  });

  it('rejects an invalid unsubscribe token with 400', async () => {
    const app = createApp();
    const res = await request(app).get(
      '/api/v1/public/test/unsubscribe-token?token=abc.123.invalid',
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  it('rejects an expired unsubscribe token with 400', async () => {
    const token = signUnsubscribeToken(payload, { ttlSeconds: -10 });
    const app = createApp();
    const res = await request(app).get(
      `/api/v1/public/test/unsubscribe-token?token=${encodeURIComponent(token)}`,
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40002);
  });

  it('rejects a token signed for a different project', async () => {
    const token = signUnsubscribeToken({ ...payload, project_id: 'proj_other' });
    const app = createApp();
    const res = await request(app).get(
      `/api/v1/public/test/unsubscribe-token?token=${encodeURIComponent(token)}`,
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  it('returns 404 when the project does not exist', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(null as never);
    const app = createApp();
    const res = await request(app).get(
      '/api/v1/public/missing/unsubscribe-token?token=abc.123.invalid',
    );

    expect(res.status).toBe(404);
  });
});
