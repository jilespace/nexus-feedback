import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import i18n from '@/i18n';
import { auditActionLabel, auditActionTone, auditTargetLabel } from '../auditLabels';

async function useLanguage(language: 'zh' | 'en') {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  }
  await i18n.changeLanguage(language);
}

describe('auditLabels', () => {
  beforeAll(async () => {
    await useLanguage('zh');
  });

  afterAll(async () => {
    await useLanguage('zh');
  });

  it('maps action prefixes to tones', () => {
    expect(auditActionTone('feedback.create')).toBe('brand');
    expect(auditActionTone('member.invite')).toBe('amber');
    expect(auditActionTone('project.update')).toBe('violet');
    expect(auditActionTone('webhook.update')).toBe('blue');
    expect(auditActionTone('comment.create')).toBe('green');
    expect(auditActionTone('unknown.action')).toBe('gray');
  });

  it('localizes action labels in both languages', async () => {
    await useLanguage('zh');
    expect(auditActionLabel('feedback.create')).toBe('创建反馈');
    expect(auditActionLabel('feedback.import')).toBe('批量导入');

    await useLanguage('en');
    expect(auditActionLabel('feedback.create')).toBe('Create feedback');
    expect(auditActionLabel('member.invite')).toBe('Invite member');
  });

  it('passes unknown actions through unchanged', async () => {
    await useLanguage('en');
    expect(auditActionLabel('custom.event')).toBe('custom.event');
  });

  it('localizes target types', async () => {
    await useLanguage('zh');
    expect(auditTargetLabel('feedback')).toBe('反馈');
    await useLanguage('en');
    expect(auditTargetLabel('feedback')).toBe('Feedback');
    expect(auditTargetLabel('member')).toBe('Member');
    expect(auditTargetLabel('mystery')).toBe('mystery');
  });
});
