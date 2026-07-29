import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerOrganization, memberLogin, inviteMember, regenerateProjectApiKey } from '../organization.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    organization: { findUnique: vi.fn(), create: vi.fn() },
    member: { findUnique: vi.fn(), create: vi.fn() },
    project: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../config/index.js', () => ({
  env: { JWT_SECRET: 'test-secret' },
}));

vi.mock('argon2', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed'), verify: vi.fn() },
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn().mockReturnValue('mock-token') },
}));

import { prisma } from '../../db/client.js';
import argon2 from 'argon2';

beforeEach(() => { vi.clearAllMocks(); });

describe('OrganizationService', () => {
  describe('registerOrganization', () => {
    it('should create org with owner and project', async () => {
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue(null);
      (prisma.organization.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({
          id: 'org-1', name: 'Test Org', slug: 'test-org',
          members: [{ id: 'm-1', email: 'a@b.com' }],
          projects: [{ id: 'p-1' }],
        });

      const result = await registerOrganization({
        name: 'Test Org', slug: 'test-org',
        email: 'a@b.com', password: '123456',
      });

      expect(result.slug).toBe('test-org');
      expect(result.member.email).toBe('a@b.com');
      expect(prisma.organization.create).toHaveBeenCalled();
    });

    it('should throw ConflictError if slug exists', async () => {
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'existing' });

      await expect(registerOrganization({
        name: 'Test', slug: 'taken', email: 'a@b.com', password: '123',
      })).rejects.toThrow('该组织标识已被使用');
    });
  });

  describe('memberLogin', () => {
    it('should return token for valid credentials', async () => {
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'org-1', slug: 'demo' });
      (prisma.member.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'm-1', email: 'a@b.com', password_hash: 'h', role: 'owner' });
      (argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await memberLogin('a@b.com', 'pass', 'demo');
      expect(result.token).toBe('mock-token');
      expect(result.member.email).toBe('a@b.com');
    });

    it('should throw AuthError for invalid password', async () => {
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'org-1', slug: 'demo' });
      (prisma.member.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'm-1', email: 'a@b.com', password_hash: 'h', role: 'owner' });
      (argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(memberLogin('a@b.com', 'wrong', 'demo'))
        .rejects.toThrow('邮箱或密码错误');
    });
  });

  describe('inviteMember', () => {
    it('should create a new member', async () => {
      (prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.member.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'm-2', email: 'new@b.com', role: 'member' });

      const result = await inviteMember('org-1', {
        email: 'new@b.com', password: '123456',
      });
      expect(result.email).toBe('new@b.com');
      expect(result.role).toBe('member');
    });
  });

  describe('regenerateProjectApiKey', () => {
    it('should rotate key for project owned by organization', async () => {
      (prisma.project.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'p-1', org_id: 'org-1' });
      (prisma.project.update as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'p-1', api_key_prefix: 'nf_12345' });

      const result = await regenerateProjectApiKey('org-1', 'p-1');

      expect(result.id).toBe('p-1');
      expect(result.api_key).toMatch(/^nf_/);
      expect(result.api_key_prefix).toBe(result.api_key.slice(0, 8));
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: {
          api_key_hash: expect.any(String),
          api_key_prefix: result.api_key_prefix,
        },
      });
    });
  });
});
