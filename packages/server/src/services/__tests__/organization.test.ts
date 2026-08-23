import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerOrganization, memberLogin, inviteMember, acceptInvite, regenerateProjectApiKey } from '../organization.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    organization: { findUnique: vi.fn(), create: vi.fn() },
    member: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    project: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../config/index.js', () => ({
  env: { JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars', BASE_URL: 'http://localhost:8080' },
}));

vi.mock('argon2', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed'), verify: vi.fn() },
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn().mockReturnValue('mock-token') },
}));

vi.mock('../audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../systemConfig.js', () => ({
  getEmailConfig: vi.fn(),
}));

vi.mock('../email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../db/client.js';
import argon2 from 'argon2';
import { getEmailConfig } from '../systemConfig.js';
import { sendEmail } from '../email.js';

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
        email: 'a@b.com', password: 'Passw0rd123',
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

    it('should throw when password_hash is null (pending invite)', async () => {
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'org-1', slug: 'demo' });
      (prisma.member.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'm-1', email: 'a@b.com', password_hash: null, role: 'member' });

      await expect(memberLogin('a@b.com', 'pass', 'demo'))
        .rejects.toThrow('请先通过邮件邀请链接设置密码');
    });
  });

  describe('inviteMember', () => {
    it('should create a new member', async () => {
      (prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'org-1', name: 'Test Org' });
      (prisma.member.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'm-2', email: 'new@b.com', role: 'member' });

      const result = await inviteMember('org-1', {
        email: 'new@b.com', password: 'Passw0rd123',
      }, 'admin');
      expect(result.email).toBe('new@b.com');
      expect(result.role).toBe('member');
    });

    it('should forbid admin from minting an owner', async () => {
      await expect(inviteMember('org-1', {
        email: 'new@b.com', password: 'Passw0rd123', role: 'owner',
      }, 'admin')).rejects.toThrow('只有所有者可以创建所有者');
      expect(prisma.member.create).not.toHaveBeenCalled();
    });

    it('should allow owner to mint an owner', async () => {
      (prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'org-1', name: 'Test Org' });
      (prisma.member.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'm-3', email: 'owner2@b.com', role: 'owner' });

      const result = await inviteMember('org-1', {
        email: 'owner2@b.com', password: 'Passw0rd123', role: 'owner',
      }, 'owner');
      expect(result.role).toBe('owner');
    });

    it('should return invite_url when no password and email unconfigured', async () => {
      (prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'org-1', name: 'Test Org' });
      (prisma.member.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'm-2', email: 'new@b.com', role: 'member' });
      (getEmailConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ apiKey: '', fromEmail: '' });

      const result = await inviteMember('org-1', { email: 'new@b.com' }, 'admin');
      expect(result.invited).toBe(true);
      expect(result.email_sent).toBe(false);
      expect(result.invite_url).toContain('/invite-accept?token=');
    });

    it('should send email when no password and email configured', async () => {
      (prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'org-1', name: 'Test Org' });
      (prisma.member.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'm-3', email: 'new@b.com', role: 'member' });
      (getEmailConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ apiKey: 're_xxx', fromEmail: 'test@test.com' });

      const result = await inviteMember('org-1', { email: 'new@b.com' }, 'admin');
      expect(result.invited).toBe(true);
      expect(result.email_sent).toBe(true);
      expect(sendEmail).toHaveBeenCalled();
    });
  });

  describe('acceptInvite', () => {
    it('should activate member with valid token and password', async () => {
      const member = { id: 'm-1', email: 'a@b.com', invite_token: 'hashed', invite_token_expiry: new Date(Date.now() + 3600000) };
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(member);
      (prisma.member.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (argon2.hash as ReturnType<typeof vi.fn>).mockResolvedValue('new-hash');

      const result = await acceptInvite('raw-token', 'Passw0rd123');
      expect(result.email).toBe('a@b.com');
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: {
          password_hash: 'new-hash',
          invite_token: null,
          invite_token_expiry: null,
        },
      });
    });

    it('should throw for expired invite token', async () => {
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(acceptInvite('expired-token', 'Passw0rd123'))
        .rejects.toThrow('邀请链接无效或已过期');
    });

    it('should throw for invalid invite token', async () => {
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(acceptInvite('bad-token', 'Passw0rd123'))
        .rejects.toThrow('邀请链接无效或已过期');
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
