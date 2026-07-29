import type { Response } from 'express';

type SuccessPayload<T> = {
  code: 0;
  data: T;
  message: string;
};

type ErrorPayload = {
  code: number;
  data: null;
  message: string;
};

export function success<T>(res: Response, data: T, status = 200): void {
  const body: SuccessPayload<T> = { code: 0, data, message: 'ok' };
  res.type('application/json; charset=utf-8').status(status).json(body);
}

export function fail(res: Response, statusCode: number, code: number, message: string): void {
  const body: ErrorPayload = { code, data: null, message };
  res.type('application/json; charset=utf-8').status(statusCode).json(body);
}
