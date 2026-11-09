import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../config/index.js', () => ({
  env: { JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars' },
}));

vi.mock('../../db/client.js', () => ({ prisma: {} }));

import { adminAuth } from '../auth.js';
import { orgAuth } from '../orgAuth.js';
import { AppError } from '../../utils/errors.js';

const SECRET = 'test-secret-key-that-is-at-least-32-chars';

function run(
  mw: (req: Request, res: Response, next: NextFunction) => void,
  token: string,
): { req: Request; error: unknown } {
  const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
  const res = {} as Response;
  const captured: { error: unknown } = { error: undefined };
  mw(req, res, (err?: unknown) => {
    captured.error = err;
  });
  return { req, error: captured.error };
}

describe('orgAuth', () => {
  it('accepts an org token and sets member context', () => {
    const token = jwt.sign({ memberId: 'm1', orgId: 'org1', role: 'owner', typ: 'org' }, SECRET);
    const { req, error } = run(orgAuth, token);
    expect(error).toBeUndefined();
    expect(req.memberId).toBe('m1');
    expect(req.orgId).toBe('org1');
    expect(req.memberRole).toBe('owner');
  });

  it('rejects an admin token with AuthError 40110', () => {
    const token = jwt.sign({ sub: 'admin1', typ: 'admin' }, SECRET);
    const { error } = run(orgAuth, token);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(40110);
  });

  it('rejects an org-claim token without typ discriminator', () => {
    const token = jwt.sign({ memberId: 'm1', orgId: 'org1', role: 'owner' }, SECRET);
    const { error } = run(orgAuth, token);
    expect((error as AppError).code).toBe(40110);
  });

  it('rejects a token signed with a non-HS256 algorithm', () => {
    const token = jwt.sign({ memberId: 'm1', orgId: 'org1', role: 'owner', typ: 'org' }, SECRET, {
      algorithm: 'HS512',
    });
    const { error } = run(orgAuth, token);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(40101);
  });
});

describe('adminAuth', () => {
  it('accepts an admin token and sets adminId', () => {
    const token = jwt.sign({ sub: 'admin1', typ: 'admin' }, SECRET);
    const { req, error } = run(adminAuth, token);
    expect(error).toBeUndefined();
    expect(req.adminId).toBe('admin1');
  });

  it('accepts an org member token and maps member context', () => {
    const token = jwt.sign({ memberId: 'm1', orgId: 'org1', role: 'owner', typ: 'org' }, SECRET);
    const { req, error } = run(adminAuth, token);
    expect(error).toBeUndefined();
    expect(req.memberId).toBe('m1');
    expect(req.orgId).toBe('org1');
    expect(req.memberRole).toBe('owner');
  });

  it('treats a legacy admin token as an owner', () => {
    const token = jwt.sign({ sub: 'admin1', typ: 'admin' }, SECRET);
    const { req, error } = run(adminAuth, token);
    expect(error).toBeUndefined();
    expect(req.memberRole).toBe('owner');
  });

  it('rejects a token without typ discriminator', () => {
    const token = jwt.sign({ sub: 'legacy-admin' }, SECRET);
    const { error } = run(adminAuth, token);
    expect((error as AppError).code).toBe(40110);
  });
});
