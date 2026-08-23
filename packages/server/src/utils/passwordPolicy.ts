import { ValidationError } from './errors.js';

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

export function validatePasswordStrength(password: string): void {
  const valid =
    typeof password === 'string' &&
    password.length >= MIN_LENGTH &&
    password.length <= MAX_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password);

  if (!valid) {
    throw new ValidationError('密码强度不足：至少8位，需包含大小写字母和数字');
  }
}
