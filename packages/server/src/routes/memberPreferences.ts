import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { orgAuth } from '../middleware/orgAuth.js';
import { success } from '../utils/response.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { prisma } from '../db/client.js';

export const MAX_SAVED_VIEWS = 10;
export const MAX_SAVED_VIEW_NAME_LENGTH = 50;
const MAX_FILTER_ENTRIES = 50;
const MAX_FILTER_KEY_LENGTH = 50;
const MAX_FILTER_VALUE_LENGTH = 200;

export type SavedViewRecord = {
  name: string;
  filters: Record<string, string>;
  created_at: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFilters(input: unknown, viewName: string): Record<string, string> {
  if (!isPlainObject(input)) {
    throw new ValidationError(`视图「${viewName}」的过滤条件必须是对象`);
  }
  const entries = Object.entries(input);
  if (entries.length > MAX_FILTER_ENTRIES) {
    throw new ValidationError(`视图「${viewName}」的过滤条件过多`);
  }
  const filters: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!key || key.length > MAX_FILTER_KEY_LENGTH) {
      throw new ValidationError(`视图「${viewName}」的过滤字段名无效`);
    }
    if (typeof value !== 'string' || value.length > MAX_FILTER_VALUE_LENGTH) {
      throw new ValidationError(`视图「${viewName}」的过滤值必须是字符串`);
    }
    filters[key] = value;
  }
  return filters;
}

function normalizeCreatedAt(value: unknown, viewName: string): string {
  if (value === undefined || value === null) return new Date().toISOString();
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    throw new ValidationError(`视图「${viewName}」的创建时间无效`);
  }
  return new Date(value).toISOString();
}

/** Validates the PUT payload: an array of up to 10 uniquely named views. */
export function parseSavedViewsPayload(input: unknown): SavedViewRecord[] {
  if (!Array.isArray(input)) {
    throw new ValidationError('saved_views 必须是数组');
  }
  if (input.length > MAX_SAVED_VIEWS) {
    throw new ValidationError(`最多保存 ${MAX_SAVED_VIEWS} 个视图`);
  }
  const seen = new Set<string>();
  return input.map((item) => {
    if (!isPlainObject(item)) throw new ValidationError('视图必须是对象');
    if (typeof item.name !== 'string') throw new ValidationError('视图名称不能为空');
    const name = item.name.trim();
    if (!name) throw new ValidationError('视图名称不能为空');
    if (name.length > MAX_SAVED_VIEW_NAME_LENGTH) {
      throw new ValidationError(`视图名称不能超过 ${MAX_SAVED_VIEW_NAME_LENGTH} 个字符`);
    }
    if (seen.has(name)) throw new ValidationError('视图名称不能重复');
    seen.add(name);
    return {
      name,
      filters: parseFilters(item.filters, name),
      created_at: normalizeCreatedAt(item.created_at, name),
    };
  });
}

/** Reads stored JSON defensively so one corrupt entry cannot break the whole list. */
export function readStoredSavedViews(raw: Prisma.JsonValue | null): SavedViewRecord[] {
  if (!Array.isArray(raw)) return [];
  const views: SavedViewRecord[] = [];
  for (const item of raw) {
    if (!isPlainObject(item) || typeof item.name !== 'string' || !item.name.trim()) continue;
    if (!isPlainObject(item.filters)) continue;
    const filters: Record<string, string> = {};
    let valid = true;
    for (const [key, value] of Object.entries(item.filters)) {
      if (typeof value !== 'string') {
        valid = false;
        break;
      }
      filters[key] = value;
    }
    if (!valid) continue;
    const createdAt =
      typeof item.created_at === 'string' && !Number.isNaN(new Date(item.created_at).getTime())
        ? item.created_at
        : new Date(0).toISOString();
    views.push({ name: item.name.trim(), filters, created_at: createdAt });
  }
  return views;
}

export const memberPreferencesRouter = Router();

memberPreferencesRouter.use(orgAuth);

memberPreferencesRouter.get('/member/saved-views', async (req, res, next) => {
  try {
    const member = await prisma.member.findFirst({
      where: { id: req.memberId!, org_id: req.orgId! },
      select: { saved_views: true },
    });
    if (!member) throw new NotFoundError('成员不存在');
    success(res, readStoredSavedViews(member.saved_views));
  } catch (err) {
    next(err);
  }
});

memberPreferencesRouter.put('/member/saved-views', async (req, res, next) => {
  try {
    // Accept either a bare array or `{ views: [...] }` for client convenience.
    const payload = Array.isArray(req.body) ? req.body : req.body?.views;
    const views = parseSavedViewsPayload(payload);
    const member = await prisma.member.findFirst({
      where: { id: req.memberId!, org_id: req.orgId! },
      select: { id: true },
    });
    if (!member) throw new NotFoundError('成员不存在');
    await prisma.member.update({
      where: { id: req.memberId! },
      data: { saved_views: views as unknown as Prisma.InputJsonValue },
    });
    success(res, views);
  } catch (err) {
    next(err);
  }
});
