import crypto from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { env } from '../config/index.js';
import {
  AuthError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';
import { parsePagination, paginatedResult } from '../utils/pagination.js';
import { logAudit } from './audit.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateApiKey(): string {
  return `nf_${crypto.randomBytes(24).toString('hex')}`;
}

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export type RegisterInput = {
  name: string;
  slug?: string;
  email: string;
  password: string;
  display_name?: string;
};

export async function registerOrganization(input: RegisterInput) {
  const slug = input.slug || slugify(input.name);
  if (!slug) throw new ValidationError('组织名称无效');

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) throw new ConflictError('该组织标识已被使用');

  const passwordHash = await argon2.hash(input.password);
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  const org = await prisma.organization.create({
    data: {
      name: input.name,
      slug,
      members: {
        create: {
          email: input.email,
          password_hash: passwordHash,
          display_name: input.display_name || '',
          role: 'owner',
        },
      },
      projects: {
        create: {
          name: 'Default Project',
          slug: 'default',
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKey.slice(0, 8),
          allowed_origins: [],
        },
      },
    },
    include: { members: true, projects: true },
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    api_key: apiKey,
    member: { id: org.members[0]!.id, email: org.members[0]!.email },
  };
}

export async function memberLogin(email: string, password: string, orgSlug: string) {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new NotFoundError('组织不存在');

  const member = await prisma.member.findUnique({
    where: { email_org_id: { email, org_id: org.id } },
  });
  if (!member) throw new AuthError(40110, '邮箱或密码错误');

  const valid = await argon2.verify(member.password_hash, password);
  if (!valid) throw new AuthError(40110, '邮箱或密码错误');

  const token = jwt.sign(
    { memberId: member.id, orgId: org.id, role: member.role },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );

  return {
    token,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    member: { id: member.id, email: member.email, role: member.role },
  };
}

export type InviteMemberInput = {
  email: string;
  password: string;
  display_name?: string;
  role?: string;
};

export async function inviteMember(orgId: string, input: InviteMemberInput) {
  const existing = await prisma.member.findUnique({
    where: { email_org_id: { email: input.email, org_id: orgId } },
  });
  if (existing) throw new ConflictError('该成员已存在');

  const passwordHash = await argon2.hash(input.password);
  const member = await prisma.member.create({
    data: {
      email: input.email,
      password_hash: passwordHash,
      display_name: input.display_name || '',
      role: input.role || 'member',
      org_id: orgId,
    },
  });

  logAudit({
    orgId,
    action: 'member.invite',
    targetType: 'member',
    targetId: member.id,
    metadata: { email: input.email, role: input.role || 'member' },
  }).catch(() => {});

  return { id: member.id, email: member.email, role: member.role };
}

export async function listMembers(
  orgId: string,
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const [items, total] = await Promise.all([
    prisma.member.findMany({
      where: { org_id: orgId },
      select: { id: true, email: true, display_name: true, role: true, created_at: true },
      orderBy: { created_at: 'asc' },
      skip: pagination?.skip,
      take: pagination?.take,
    }),
    prisma.member.count({ where: { org_id: orgId } }),
  ]);

  return paginatedResult(items, total, pagination?.page ?? 1, pagination?.pageSize ?? 20);
}

const VALID_ROLES = ['owner', 'admin', 'member'] as const;
export type MemberRole = (typeof VALID_ROLES)[number];

export async function updateMemberRole(orgId: string, memberId: string, role: string) {
  if (!VALID_ROLES.includes(role as MemberRole)) {
    throw new ValidationError('无效的角色类型');
  }
  const member = await prisma.member.findFirst({
    where: { id: memberId, org_id: orgId },
  });
  if (!member) throw new NotFoundError('成员不存在');
  if (member.role === 'owner') {
    throw new ForbiddenError('无法修改所有者角色');
  }

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { role },
    select: { id: true, email: true, display_name: true, role: true, created_at: true },
  });

  logAudit({
    orgId,
    action: 'member.update_role',
    targetType: 'member',
    targetId: memberId,
    metadata: { old_role: member.role, new_role: role },
  }).catch(() => {});

  return updated;
}

export async function removeMember(orgId: string, memberId: string) {
  const member = await prisma.member.findFirst({
    where: { id: memberId, org_id: orgId },
  });
  if (!member) throw new NotFoundError('成员不存在');
  if (member.role === 'owner') throw new ForbiddenError('无法移除组织所有者');

  await prisma.member.delete({ where: { id: memberId } });

  logAudit({
    orgId,
    action: 'member.remove',
    targetType: 'member',
    targetId: memberId,
    metadata: { email: member.email },
  }).catch(() => {});

  return { id: memberId };
}

export async function deleteProject(orgId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
  });
  if (!project) throw new NotFoundError('项目不存在');

  const feedbacks = await prisma.feedback.findMany({
    where: { project_id: projectId },
    select: { id: true },
  });
  const feedbackIds = feedbacks.map((f) => f.id);

  await prisma.$transaction([
    prisma.changelogFeedback.deleteMany({ where: { feedback_id: { in: feedbackIds } } }),
    prisma.feedbackTag.deleteMany({ where: { feedback_id: { in: feedbackIds } } }),
    prisma.vote.deleteMany({ where: { feedback_id: { in: feedbackIds } } }),
    prisma.comment.deleteMany({ where: { feedback_id: { in: feedbackIds } } }),
    prisma.reply.deleteMany({ where: { feedback_id: { in: feedbackIds } } }),
    prisma.attachment.deleteMany({ where: { project_id: projectId } }),
    prisma.statusHistory.deleteMany({ where: { feedback_id: { in: feedbackIds } } }),
    prisma.internalNote.deleteMany({ where: { feedback_id: { in: feedbackIds } } }),
    prisma.feedback.deleteMany({ where: { project_id: projectId } }),
    prisma.changelog.deleteMany({ where: { project_id: projectId } }),
    prisma.webhook.deleteMany({ where: { project_id: projectId } }),
    prisma.sSOConfig.deleteMany({ where: { project_id: projectId } }),
    prisma.statusConfig.deleteMany({ where: { project_id: projectId } }),
    prisma.project.delete({ where: { id: projectId } }),
  ]);

  logAudit({
    orgId,
    action: 'project.delete',
    targetType: 'project',
    targetId: projectId,
    metadata: { name: project.name },
  }).catch(() => {});

  return { id: projectId };
}

export async function regenerateProjectApiKey(orgId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
  });
  if (!project) throw new NotFoundError('项目不存在');

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const apiKeyPrefix = apiKey.slice(0, 8);

  await prisma.project.update({
    where: { id: projectId },
    data: { api_key_hash: apiKeyHash, api_key_prefix: apiKeyPrefix },
  });

  logAudit({
    orgId,
    action: 'project.regenerate_key',
    targetType: 'project',
    targetId: projectId,
  }).catch(() => {});

  return { id: projectId, api_key: apiKey, api_key_prefix: apiKeyPrefix };
}

export type CreateProjectInput = {
  name: string;
  slug?: string;
};

export async function createProject(orgId: string, input: CreateProjectInput) {
  const name = input.name.trim();
  if (!name) throw new ValidationError('项目名称不能为空');

  const slug = input.slug?.trim() || slugify(name);
  if (!slug) throw new ValidationError('项目标识无效');

  const existing = await prisma.project.findFirst({
    where: { org_id: orgId, slug },
  });
  if (existing) throw new ConflictError('该项目标识已被使用');

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const apiKeyPrefix = apiKey.slice(0, 8);

  const project = await prisma.project.create({
    data: {
      name,
      slug,
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
      allowed_origins: [],
      org_id: orgId,
    },
  });

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    api_key: apiKey,
    api_key_prefix: apiKeyPrefix,
    allowed_origins: project.allowed_origins,
    created_at: project.created_at.toISOString(),
  };
}

export async function updateProject(
  orgId: string,
  projectId: string,
  input: { name?: string; slug?: string; allowed_origins?: string[] },
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
  });
  if (!project) throw new NotFoundError('项目不存在');

  const data: { name?: string; slug?: string; allowed_origins?: string[] } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new ValidationError('项目名称不能为空');
    data.name = name;
  }
  if (input.slug !== undefined) {
    const slug = input.slug.trim();
    if (!slug) throw new ValidationError('项目标识不能为空');
    data.slug = slug;
  }
  if (input.allowed_origins !== undefined) {
    if (!Array.isArray(input.allowed_origins)) {
      throw new ValidationError('allowed_origins 必须是数组');
    }
    data.allowed_origins = input.allowed_origins;
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data,
  });

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    api_key_prefix: updated.api_key_prefix,
    allowed_origins: updated.allowed_origins,
    updated_at: updated.updated_at.toISOString(),
  };
}
