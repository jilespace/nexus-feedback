import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import i18n from '@/i18n';
import { localizeApiError, localizeNetworkError } from '../apiErrors';

async function useLanguage(language: 'zh' | 'en') {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  }
  await i18n.changeLanguage(language);
}

describe('apiErrors', () => {
  beforeAll(async () => {
    await useLanguage('zh');
  });

  afterAll(async () => {
    await useLanguage('zh');
  });

  it('localizes generic error codes', async () => {
    await useLanguage('zh');
    expect(localizeApiError(40110, '认证令牌无效或已过期')).toBe('登录已过期，请重新登录');
    expect(localizeApiError(42901, '请求过于频繁')).toBe('请求过于频繁，请稍后再试');

    await useLanguage('en');
    expect(localizeApiError(40110, '认证令牌无效或已过期')).toBe(
      'Your session has expired, please sign in again',
    );
    expect(localizeApiError(40101, '邮箱或密码错误')).toBe('Invalid email or password');
    expect(localizeApiError(40111, '请先通过邮件邀请链接设置密码')).toBe(
      'Account not activated yet, use your invite link to set a password',
    );
  });

  it('keeps server detail for validation errors with a localized prefix', async () => {
    await useLanguage('zh');
    expect(localizeApiError(40001, '无效的分类: x')).toBe('请求参数校验失败：无效的分类: x');
    await useLanguage('en');
    expect(localizeApiError(40001, '无效的分类: x')).toBe('Validation failed: 无效的分类: x');
    expect(localizeApiError(40900, '')).toBe('Action conflict');
  });

  it('falls back to the server message for unknown codes', async () => {
    await useLanguage('en');
    expect(localizeApiError(12345, '自定义错误')).toBe('自定义错误');
    expect(localizeApiError(12345, '')).toBe('Something went wrong on our side, please retry');
  });

  it('localizes network failures', async () => {
    await useLanguage('zh');
    expect(localizeNetworkError()).toContain('网络');
    await useLanguage('en');
    expect(localizeNetworkError()).toContain('Network');
  });
});
