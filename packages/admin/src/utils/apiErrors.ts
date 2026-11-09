import i18n from '@/i18n';

/**
 * Server errors carry stable numeric codes. Generic codes that describe the
 * class of failure are localized here; validation/conflict errors keep their
 * specific server detail so users still learn what exactly is wrong.
 */
const GENERIC_CODE_KEYS: Record<number, string> = {
  40100: 'errors.unauthenticated',
  40101: 'errors.invalid_credentials',
  40110: 'errors.invalid_session',
  40111: 'errors.account_not_activated',
  40300: 'errors.forbidden',
  40400: 'errors.not_found',
  41300: 'errors.file_too_large',
  41500: 'errors.unsupported_file',
  42900: 'errors.too_many_attempts',
  42901: 'errors.rate_limited',
  42902: 'errors.rate_limited_api',
  50000: 'errors.internal',
};

const DETAILED_CODE_KEYS: Record<number, string> = {
  40001: 'errors.validation',
  40900: 'errors.conflict',
};

export function localizeApiError(code: number, serverMessage: string): string {
  const t = i18n.getFixedT(i18n.language);
  const genericKey = GENERIC_CODE_KEYS[code];
  if (genericKey) return t(genericKey);

  const detailedKey = DETAILED_CODE_KEYS[code];
  if (detailedKey) {
    const prefix = t(detailedKey);
    if (!serverMessage) return prefix;
    return i18n.language.startsWith('en') ? `${prefix}: ${serverMessage}` : `${prefix}：${serverMessage}`;
  }

  return serverMessage || t('errors.internal');
}

export function localizeNetworkError(): string {
  return i18n.getFixedT(i18n.language)('errors.network');
}
