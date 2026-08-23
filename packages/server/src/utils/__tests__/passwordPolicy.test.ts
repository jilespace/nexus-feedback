import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from '../passwordPolicy.js';
import { ValidationError } from '../errors.js';

describe('validatePasswordStrength', () => {
  it('accepts a password with lowercase, uppercase and digit', () => {
    expect(() => validatePasswordStrength('Passw0rd123')).not.toThrow();
  });

  it('rejects passwords shorter than 8 chars', () => {
    expect(() => validatePasswordStrength('Ab1x')).toThrow(ValidationError);
    expect(() => validatePasswordStrength('Ab1x')).toThrow('密码强度不足：至少8位，需包含大小写字母和数字');
  });

  it('rejects passwords longer than 128 chars', () => {
    const long = 'Ab1' + 'a'.repeat(126);
    expect(() => validatePasswordStrength(long)).toThrow(ValidationError);
  });

  it('rejects passwords without uppercase', () => {
    expect(() => validatePasswordStrength('password1')).toThrow('密码强度不足：至少8位，需包含大小写字母和数字');
  });

  it('rejects passwords without lowercase', () => {
    expect(() => validatePasswordStrength('PASSWORD1')).toThrow(ValidationError);
  });

  it('rejects passwords without digit', () => {
    expect(() => validatePasswordStrength('PasswordOnly')).toThrow(ValidationError);
  });
});
