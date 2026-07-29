import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/index.js', () => ({
  env: { BASE_URL: 'https://feedback.example.com' },
}));

const { buildStatusChangeEmail, buildReplyEmail, buildNewFeedbackEmail, buildDigestEmail } =
  await import('../emailTemplates.js');

describe('Email Templates', () => {
  it('buildStatusChangeEmail uses configurable base URL', () => {
    const html = buildStatusChangeEmail('Test Title', 'resolved', 'fb_1');
    expect(html).toContain('https://feedback.example.com/feedback/fb_1');
    expect(html).toContain('Test Title');
    expect(html).toContain('resolved');
  });

  it('buildReplyEmail includes reply content', () => {
    const html = buildReplyEmail('Test Title', 'Thanks for reporting!', 'fb_2');
    expect(html).toContain('Thanks for reporting!');
    expect(html).toContain('https://feedback.example.com/feedback/fb_2');
  });

  it('buildNewFeedbackEmail includes title and category', () => {
    const html = buildNewFeedbackEmail('New Idea', 'feature', 'fb_3');
    expect(html).toContain('New Idea');
    expect(html).toContain('feature');
  });

  it('buildDigestEmail includes weekly summary stats', () => {
    const html = buildDigestEmail({ newCount: 5, resolvedCount: 3, topFeedback: [{ title: 'Top', votes: 10 }] });
    expect(html).toContain('5');
    expect(html).toContain('3');
    expect(html).toContain('Top');
  });
});
