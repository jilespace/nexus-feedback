import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      data: null,
      message: err.message,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          code: 40900,
          data: null,
          message: '数据已存在，请勿重复创建',
        });
        return;
      case 'P2003':
        res.status(400).json({
          code: 40002,
          data: null,
          message: '关联数据不存在',
        });
        return;
      case 'P2025':
        res.status(404).json({
          code: 40400,
          data: null,
          message: '资源不存在',
        });
        return;
    }
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    code: 50000,
    data: null,
    message: '服务器内部错误',
  });
}
