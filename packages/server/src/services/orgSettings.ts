import { prisma } from '../db/client.js';
import { env } from '../config/index.js';
import { NotFoundError, ValidationError, AuthError } from '../utils/errors.js';
import { validatePasswordStrength } from '../utils/passwordPolicy.js';
import { sendEmail } from './email.js';
import argon2 from 'argon2';
import crypto from 'crypto';

export async function getOrgSettings(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, logo_url: true, brand_color: true, board_url: true },
  });
  if (!org) throw new NotFoundError('组织不存在');
  return org;
}

export async function updateOrgSettings(
  orgId: string,
  data: { name?: string; logo_url?: string; brand_color?: string; board_url?: string | null },
) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new NotFoundError('组织不存在');

  if (typeof data.board_url === 'string' && data.board_url.trim() !== '') {
    const parsed = new URL(data.board_url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new ValidationError('看板地址必须是 http(s) URL');
    }
  }

  const updateData: Record<string, string | null> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.logo_url !== undefined) updateData.logo_url = data.logo_url;
  if (data.brand_color !== undefined) updateData.brand_color = data.brand_color;
  if (data.board_url !== undefined) {
    updateData.board_url = typeof data.board_url === 'string' && data.board_url.trim() === '' ? null : data.board_url;
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: updateData,
    select: { id: true, name: true, slug: true, logo_url: true, brand_color: true, board_url: true },
  });
  return updated;
}

export async function changePassword(
  memberId: string,
  currentPassword: string,
  newPassword: string,
) {
  if (!currentPassword || !newPassword) {
    throw new ValidationError('当前密码和新密码不能为空');
  }
  validatePasswordStrength(newPassword);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new NotFoundError('成员不存在');
  if (!member.password_hash) throw new AuthError(40100, '请先通过邮件邀请链接设置密码');

  const valid = await argon2.verify(member.password_hash, currentPassword);
  if (!valid) throw new AuthError(40100, '当前密码错误');

  const newHash = await argon2.hash(newPassword);
  await prisma.member.update({
    where: { id: memberId },
    data: { password_hash: newHash },
  });

  return { success: true };
}

export async function forgotPassword(email: string, orgSlug: string) {
  if (!email || !orgSlug) {
    throw new ValidationError('邮箱和组织标识不能为空');
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) return { sent: true }; // Don't reveal org existence

  const member = await prisma.member.findFirst({
    where: { email, org_id: org.id },
  });
  if (!member) return { sent: true }; // Don't reveal member existence

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.member.update({
    where: { id: member.id },
    data: { reset_token: tokenHash, reset_token_expiry: expiry },
  });

  const frontendUrl = env.BASE_URL;
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  sendEmail(
    email,
    '重置密码 - Nexus Feedback',
    `<p>您好，</p><p>您请求了密码重置。请点击以下链接重置密码：</p><p><a href="${resetUrl}">重置密码</a></p><p>此链接将在 1 小时后过期。</p><p>如果您没有请求重置密码，请忽略此邮件。</p>`,
    org.id
  ).catch(() => {});

  return { sent: true };
}

export async function resetPassword(token: string, newPassword: string) {
  if (!token || !newPassword) {
    throw new ValidationError('令牌和新密码不能为空');
  }
  validatePasswordStrength(newPassword);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const member = await prisma.member.findFirst({
    where: {
      reset_token: tokenHash,
      reset_token_expiry: { gte: new Date() },
    },
  });
  if (!member) throw new AuthError(40100, '重置令牌无效或已过期');

  const newHash = await argon2.hash(newPassword);
  await prisma.member.update({
    where: { id: member.id },
    data: {
      password_hash: newHash,
      reset_token: null,
      reset_token_expiry: null,
    },
  });

  return { success: true };
}
