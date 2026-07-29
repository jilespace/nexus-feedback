const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 40001, message);
  }
}

export class AuthError extends AppError {
  constructor(code: number, message: string) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '权限不足') {
    super(403, 40300, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(404, 40400, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = '状态冲突') {
    super(409, 40900, message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = '文件过大') {
    super(413, 41300, message);
  }
}

export class UnsupportedMediaError extends AppError {
  constructor(message = '不支持的文件类型') {
    super(415, 41500, message);
  }
}
