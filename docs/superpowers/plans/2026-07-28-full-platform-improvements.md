# Full Platform Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden nexus-feedback with search, notifications, analytics, webhook management, merge enhancement, custom categories, API docs, and test coverage.

**Architecture:** Each task produces self-contained changes. Backend uses Prisma + Express; frontend uses React + Tailwind. Search uses PostgreSQL `pg_trgm` trigram indexes for fast LIKE queries. Charts use pure SVG (matching existing Dashboard pattern). Email uses Resend (already configured).

**Tech Stack:** Express 5, Prisma, PostgreSQL (pg_trgm), React 18, Tailwind CSS, Vitest, Resend, React Router 6, @tanstack/react-query

---

## Task 1: Custom Feedback Categories (Backend)

**Files:**
- Create: `packages/server/prisma/migrations/<timestamp>/add_category_config/migration.sql`
- Modify: `packages/server/prisma/schema.prisma`
- Modify: `packages/server/src/services/feedback.ts:8-22`
- Create: `packages/server/src/services/categoryConfig.ts`
- Create: `packages/server/src/routes/categoryConfig.ts`
- Create: `packages/server/src/services/__tests__/categoryConfig.test.ts`

- [ ] **Step 1: Add CategoryConfig model to Prisma schema**

Edit `packages/server/prisma/schema.prisma`. Add a relation to Project and the new model:

```prisma
model CategoryConfig {
  id         String   @id @default(cuid())
  project_id String
  name       String
  color      String   @default("#6B7280")
  position   Int      @default(0)
  created_at DateTime @default(now())

  project Project @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@unique([project_id, name])
  @@map("category_config")
}
```

Add to `Project` model after `status_configs StatusConfig[]`:
```prisma
category_configs CategoryConfig[]
```

- [ ] **Step 2: Generate and apply migration**

Run: `cd packages/server && npx prisma migrate dev --name add_category_config`
Expected: Migration created and applied successfully

- [ ] **Step 3: Write failing tests for category config service**

Create `packages/server/src/services/__tests__/categoryConfig.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = {
  categoryConfig: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { listCategoryConfigs, createCategoryConfig, updateCategoryConfig, deleteCategoryConfig } =
  await import('../categoryConfig.js');

describe('CategoryConfig Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listCategoryConfigs returns ordered categories for a project', async () => {
    mockPrisma.categoryConfig.findMany.mockResolvedValue([
      { id: '1', name: 'Bug', color: '#ef4444', position: 0 },
    ]);
    const result = await listCategoryConfigs('proj_1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bug');
    expect(mockPrisma.categoryConfig.findMany).toHaveBeenCalledWith({
      where: { project_id: 'proj_1' },
      orderBy: { position: 'asc' },
    });
  });

  it('createCategoryConfig defaults color and position', async () => {
    mockPrisma.categoryConfig.count.mockResolvedValue(2);
    mockPrisma.categoryConfig.create.mockResolvedValue({
      id: '2', name: 'Idea', color: '#6B7280', position: 2,
    });
    const result = await createCategoryConfig('proj_1', { name: 'Idea' });
    expect(result.position).toBe(2);
    expect(result.color).toBe('#6B7280');
  });

  it('updateCategoryConfig updates name and color', async () => {
    mockPrisma.categoryConfig.update.mockResolvedValue({
      id: '1', name: 'Bug Fix', color: '#dc2626', position: 0,
    });
    const result = await updateCategoryConfig('proj_1', '1', { name: 'Bug Fix', color: '#dc2626' });
    expect(result.name).toBe('Bug Fix');
  });

  it('deleteCategoryConfig removes a category', async () => {
    mockPrisma.categoryConfig.delete.mockResolvedValue({ id: '1' });
    await deleteCategoryConfig('proj_1', '1');
    expect(mockPrisma.categoryConfig.delete).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/services/__tests__/categoryConfig.test.ts`
Expected: FAIL — `categoryConfig.js` does not exist

- [ ] **Step 5: Implement categoryConfig service**

Create `packages/server/src/services/categoryConfig.ts`:

```typescript
import { prisma } from '../db/client.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export async function listCategoryConfigs(projectId: string) {
  return prisma.categoryConfig.findMany({
    where: { project_id: projectId },
    orderBy: { position: 'asc' },
  });
}

export async function createCategoryConfig(
  projectId: string,
  data: { name: string; color?: string },
) {
  if (!data.name?.trim()) throw new ValidationError('分类名称不能为空');
  const count = await prisma.categoryConfig.count({ where: { project_id: projectId } });
  return prisma.categoryConfig.create({
    data: {
      project_id: projectId,
      name: data.name.trim(),
      color: data.color || '#6B7280',
      position: count,
    },
  });
}

export async function updateCategoryConfig(
  projectId: string,
  id: string,
  data: { name?: string; color?: string; position?: number },
) {
  const existing = await prisma.categoryConfig.findUnique({ where: { id } });
  if (!existing || existing.project_id !== projectId) {
    throw new NotFoundError('分类不存在');
  }
  return prisma.categoryConfig.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.position !== undefined && { position: data.position }),
    },
  });
}

export async function deleteCategoryConfig(projectId: string, id: string) {
  const existing = await prisma.categoryConfig.findUnique({ where: { id } });
  if (!existing || existing.project_id !== projectId) {
    throw new NotFoundError('分类不存在');
  }
  await prisma.categoryConfig.delete({ where: { id } });
  return { deleted: true };
}

export async function getProjectCategories(projectId: string): Promise<string[]> {
  const configs = await prisma.categoryConfig.findMany({
    where: { project_id: projectId },
    orderBy: { position: 'asc' },
    select: { name: true },
  });
  if (configs.length === 0) {
    return ['bug', 'feature', 'performance', 'ui', 'other'];
  }
  return configs.map((c) => c.name);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/server && npx vitest run src/services/__tests__/categoryConfig.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add packages/server/prisma/schema.prisma packages/server/prisma/migrations/ packages/server/src/services/categoryConfig.ts packages/server/src/services/__tests__/categoryConfig.test.ts
git commit -m "feat: add custom category configuration per project"
```

---

## Task 2: Category Config Routes & Feedback Validation Update

**Files:**
- Create: `packages/server/src/routes/categoryConfig.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/services/feedback.ts`
- Modify: `packages/server/src/services/__tests__/feedback.test.ts`

- [ ] **Step 1: Create category config router**

Create `packages/server/src/routes/categoryConfig.ts`:

```typescript
import { Router } from 'express';
import { orgAuth } from '../middleware/orgAuth.js';
import { success } from '../utils/response.js';
import {
  listCategoryConfigs,
  createCategoryConfig,
  updateCategoryConfig,
  deleteCategoryConfig,
} from '../services/categoryConfig.js';

export const categoryConfigRouter = Router();

categoryConfigRouter.get('/projects/:projectId/categories', orgAuth, async (req, res, next) => {
  try {
    const result = await listCategoryConfigs(String(req.params.projectId));
    success(res, result);
  } catch (err) {
    next(err);
  }
});

categoryConfigRouter.post('/projects/:projectId/categories', orgAuth, async (req, res, next) => {
  try {
    const result = await createCategoryConfig(String(req.params.projectId), req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

categoryConfigRouter.patch('/projects/:projectId/categories/:id', orgAuth, async (req, res, next) => {
  try {
    const result = await updateCategoryConfig(String(req.params.projectId), String(req.params.id), req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

categoryConfigRouter.delete('/projects/:projectId/categories/:id', orgAuth, async (req, res, next) => {
  try {
    await deleteCategoryConfig(String(req.params.projectId), String(req.params.id));
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Register router in app.ts**

Modify `packages/server/src/app.ts`. Add import:
```typescript
import { categoryConfigRouter } from './routes/categoryConfig.js';
```

Add after `app.use('/api/v1/org', notificationPreferenceRouter)`:
```typescript
app.use('/api/v1/org', categoryConfigRouter);
```

- [ ] **Step 3: Update feedback validation to use dynamic categories**

Modify `packages/server/src/services/feedback.ts`. Remove the hardcoded `CATEGORIES` constant (line 9) and update `validateCreateFeedback`:

```typescript
import { getProjectCategories } from './categoryConfig.js';

export async function validateCreateFeedback(data: unknown) {
  const input = data as Record<string, unknown>;
  if (typeof input.title !== 'string' || !input.title.trim()) {
    throw new ValidationError('title 不能为空');
  }
  if (typeof input.content !== 'string' || !input.content.trim()) {
    throw new ValidationError('content 不能为空');
  }
  if (!input.category || !input.project_id) {
    throw new ValidationError('category 和 project_id 不能为空');
  }
  const categories = await getProjectCategories(input.project_id as string);
  if (!categories.includes(input.category as string)) {
    throw new ValidationError(`无效的分类: ${input.category}`);
  }
  return {
    title: input.title.trim(),
    content: input.content.trim(),
    category: input.category as string,
    priority: ['low', 'medium', 'high', 'critical'].includes(input.priority as string)
      ? (input.priority as 'low' | 'medium' | 'high' | 'critical')
      : 'medium',
    source: typeof input.source === 'string' ? input.source : 'api',
    contact: typeof input.contact === 'string' ? input.contact : undefined,
    app_version: typeof input.app_version === 'string' ? input.app_version : undefined,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : undefined,
  };
}
```

- [ ] **Step 4: Update existing feedback tests**

Modify `packages/server/src/services/__tests__/feedback.test.ts`. The test for category validation needs updating since it's now dynamic. Add `project_id` to test inputs:

```typescript
it('should validate valid input', () => {
  const input = { title: 'Test feedback', content: 'This is a test', category: 'bug', priority: 'medium', project_id: 'proj_1' };
  // Mock getProjectCategories to return defaults
  const result = await validateCreateFeedback(input);
  expect(result.category).toBe('bug');
});
```

Also add mock for `getProjectCategories`:
```typescript
vi.mock('../categoryConfig.js', () => ({
  getProjectCategories: vi.fn().mockResolvedValue(['bug', 'feature', 'performance', 'ui', 'other']),
}));
```

- [ ] **Step 5: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass (may need to adjust count based on changes)

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/categoryConfig.ts packages/server/src/app.ts packages/server/src/services/feedback.ts packages/server/src/services/__tests__/feedback.test.ts
git commit -m "feat: wire category config routes and dynamic category validation"
```

---

## Task 3: Full-Text Search with PostgreSQL trigram

**Files:**
- Create: `packages/server/prisma/migrations/<timestamp>/add_trgm_index/migration.sql`
- Modify: `packages/server/src/services/feedback.ts:94-140`
- Modify: `packages/server/src/routes/admin.ts:37-52`

- [ **Step 1: Add trigram extension and index via raw migration**

Create migration file `packages/server/prisma/migrations/<timestamp>/add_trgm_index/migration.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS feedback_title_trgm_idx ON feedback USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS feedback_content_trgm_idx ON feedback USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON feedback (status);
CREATE INDEX IF NOT EXISTS feedback_category_idx ON feedback (category);
CREATE INDEX IF NOT EXISTS feedback_priority_idx ON feedback (priority);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_vote_count_idx ON feedback (vote_count DESC);
```

- [ ] **Step 2: Apply migration directly via Prisma**

Run: `cd packages/server && npx prisma migrate dev --name add_trgm_index`
Expected: Migration applied

- [ ] **Step 3: Update listFeedback service to use trigram search**

Modify `packages/server/src/services/feedback.ts`. Replace the keyword `OR` block (lines 101-106):

```typescript
if (params.keyword) {
  where.OR = [
    { title: { contains: params.keyword } },
    { content: { contains: params.keyword } },
  ];
}
```

Add `sort_by` to the params destructuring in the route handler.

- [ ] **Step 4: Expose sort_by in route**

Modify `packages/server/src/routes/admin.ts` line 37-52:

```typescript
adminRouter.get('/feedback', adminAuth, async (req, res, next) => {
  try {
    const params = {
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      priority: req.query.priority as string | undefined,
      keyword: req.query.keyword as string | undefined,
      sort_by: req.query.sort_by as 'newest' | 'oldest' | 'most_voted' | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
    };
    const result = await listFeedback(params);
    success(res, result);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/server/prisma/migrations/ packages/server/src/services/feedback.ts packages/server/src/routes/admin.ts
git commit -m "feat: add trigram search indexes and sort_by support"
```

---

## Task 4: Search UI & Sort Controls

**Files:**
- Modify: `packages/admin/src/pages/FeedbackList.tsx`
- Modify: `packages/admin/src/components/FilterBar.tsx`
- Modify: `packages/admin/src/types/index.ts`

- [ ] **Step 1: Add sort state and controls to FeedbackList**

Modify `packages/admin/src/pages/FeedbackList.tsx`. Add `sort_by` state:

```typescript
const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_voted'>('newest');
```

Update `queryParams`:
```typescript
const queryParams = new URLSearchParams({
  page: String(page),
  page_size: '20',
  ...filters,
  ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
  sort_by: sortBy,
});
```

Add sort dropdown after the search input (after line 127, before FilterBar):

```typescript
<select
  value={sortBy}
  onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
  className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
>
  <option value="newest">最新优先</option>
  <option value="oldest">最早优先</option>
  <option value="most_voted">最多投票</option>
</select>
```

Update queryKey to include `sortBy`:
```typescript
queryKey: ['feedback', page, filters, debouncedKeyword, sortBy],
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/admin && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/pages/FeedbackList.tsx
git commit -m "feat: add sort controls to feedback list"
```

---

## Task 5: Email Notification Improvements

**Files:**
- Modify: `packages/server/src/services/notification.ts`
- Create: `packages/server/src/utils/emailTemplates.ts`
- Create: `packages/server/src/utils/__tests__/emailTemplates.test.ts`
- Modify: `packages/server/src/config/index.ts`

- [ ] **Step 1: Add BASE_URL config**

Modify `packages/server/src/config/index.ts`. Add to `env` object:

```typescript
BASE_URL: process.env.BASE_URL || 'http://localhost:8080',
```

- [ ] **Step 2: Write failing test for email templates**

Create `packages/server/src/utils/__tests__/emailTemplates.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/index.js', () => ({
  env: { BASE_URL: 'https://feedback.example.com' },
}));

const { buildStatusChangeEmail, buildReplyEmail, buildNewFeedbackEmail, buildDigestEmail } =
  await import('../emailTemplates.js');

describe('Email Templates', () => {
  it('buildStatusChangeEmail uses configurable base URL', () => {
    const html = buildStatusChangeEmail('Test Title', 'resolved', 'fb_1');
    expect(html).toContain('https://feedback.example.com/feedback/fb_1');
    expect(html).toContain('https://feedback.example.com/unsubscribe?email=&project_id=&type=status_updates');
    expect(html).toContain('Test Title');
    expect(html).toContain('resolved');
  });

  it('buildReplyEmail includes reply content and unsubscribe', () => {
    const html = buildReplyEmail('Test Title', 'Thanks for reporting!', 'fb_2');
    expect(html).toContain('Thanks for reporting!');
    expect(html).toContain('https://feedback.example.com/unsubscribe');
  });

  it('buildNewFeedbackEmail includes title and category', () => {
    const html = buildNewFeedbackEmail('New Idea', 'feature', 'fb_3');
    expect(html).toContain('New Idea');
    expect(html).toContain('feature');
  });

  it('buildDigestEmail includes weekly summary stats', () => {
    const html = buildDigestEmail({ newCount: 5, resolvedCount: 3, topFeedback: [{ title: 'Top', votes: 10 }] });
    expect(html).toContain('5');
    expect(html).toContain('3');
    expect(html).toContain('Top');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/utils/__tests__/emailTemplates.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 4: Create email templates module**

Create `packages/server/src/utils/emailTemplates.ts`:

```typescript
import { env } from '../config/index.js';

const BASE_URL = env.BASE_URL || 'http://localhost:8080';

function unsubscribeUrl(email: string, projectId: string, type: string): string {
  const params = new URLSearchParams({ email, project_id: projectId, type });
  return `${BASE_URL}/unsubscribe?${params.toString()}`;
}

function emailFooter(email: string, projectId: string, type: string): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af">
  <a href="${unsubscribeUrl(email, projectId, type)}" style="color:#9ca3af">取消订阅</a>
</p>`;
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px">
<tr><td>
<div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
${content}
</div>
</td></tr>
</table>
</body></html>`;
}

export function buildStatusChangeEmail(title: string, newStatus: string, feedbackId: string): string {
  const content = `<h2 style="margin:0 0 16px;font-size:18px;color:#111827">反馈状态已更新</h2>
<p style="margin:0 0 8px;color:#374151"><strong>${escapeHtml(title)}</strong></p>
<p style="margin:0 0 16px;color:#6b7280">新状态: <strong style="color:#059669">${escapeHtml(newStatus)}</strong></p>
<a href="${BASE_URL}/feedback/${feedbackId}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">查看反馈</a>`;
  return emailWrapper(content + emailFooter('', '', 'status_updates'));
}

export function buildReplyEmail(title: string, replyContent: string, feedbackId: string): string {
  const content = `<h2 style="margin:0 0 16px;font-size:18px;color:#111827">新回复</h2>
<p style="margin:0 0 8px;color:#374151">您的反馈 <strong>${escapeHtml(title)}</strong> 收到了新回复：</p>
<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #4f46e5;background:#f9fafb;color:#374151;font-size:14px">${escapeHtml(replyContent)}</blockquote>
<a href="${BASE_URL}/feedback/${feedbackId}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">查看完整对话</a>`;
  return emailWrapper(content + emailFooter('', '', 'status_updates'));
}

export function buildNewFeedbackEmail(title: string, category: string, feedbackId: string): string {
  const content = `<h2 style="margin:0 0 16px;font-size:18px;color:#111827">新反馈提交</h2>
<p style="margin:0 0 8px;color:#374151"><strong>${escapeHtml(title)}</strong></p>
<p style="margin:0 0 16px;color:#6b7280">分类: ${escapeHtml(category)}</p>
<a href="${BASE_URL}/feedback/${feedbackId}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">查看反馈</a>`;
  return emailWrapper(content + emailFooter('', '', 'status_updates'));
}

export function buildDigestEmail(data: {
  newCount: number;
  resolvedCount: number;
  topFeedback: { title: string; votes: number }[];
}): string {
  const topList = data.topFeedback
    .map((f) => `<li style="padding:8px 0;border-bottom:1px solid #f3f4f6">${escapeHtml(f.title)} <span style="color:#9ca3af">(${f.votes} 票)</span></li>`)
    .join('');
  const content = `<h2 style="margin:0 0 16px;font-size:18px;color:#111827">本周反馈摘要</h2>
<div style="display:flex;gap:16px;margin-bottom:24px">
  <div style="flex:1;padding:16px;background:#eef2ff;border-radius:8px;text-align:center">
    <p style="margin:0;font-size:24px;font-weight:700;color:#4f46e5">${data.newCount}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#6b7280">新反馈</p>
  </div>
  <div style="flex:1;padding:16px;background:#ecfdf5;border-radius:8px;text-align:center">
    <p style="margin:0;font-size:24px;font-weight:700;color:#059669">${data.resolvedCount}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#6b7280">已解决</p>
  </div>
</div>
<h3 style="margin:0 0 8px;font-size:14px;color:#374151">热门反馈</h3>
<ul style="margin:0;padding:0;list-style:none">${topList}</ul>`;
  return emailWrapper(content + emailFooter('', '', 'weekly_digest'));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/server && npx vitest run src/utils/__tests__/emailTemplates.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Refactor notification service to use new templates**

Modify `packages/server/src/services/notification.ts`. Remove all inline `build*Email` functions and import from templates:

```typescript
import { buildStatusChangeEmail, buildReplyEmail, buildNewFeedbackEmail } from '../utils/emailTemplates.js';
```

Keep the `notifyStatusChange`, `notifyNewFeedback`, `notifyReply` functions but they now use the template builders.

- [ ] **Step 7: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/services/notification.ts packages/server/src/utils/emailTemplates.ts packages/server/src/utils/__tests__/emailTemplates.test.ts packages/server/src/config/index.ts
git commit -m "feat: refactor email templates with configurable base URL and unsubscribe links"
```

---

## Task 6: Enhanced Dashboard with Charts

**Files:**
- Modify: `packages/admin/src/pages/Dashboard.tsx`
- Modify: `packages/server/src/services/feedback.ts` (getStats)
- Modify: `packages/server/src/routes/admin.ts`

- [ ] **Step 1: Add stats endpoint for enhanced data**

Modify `packages/server/src/services/feedback.ts`. Update `getStats` to include monthly trend and source distribution:

```typescript
export async function getStats(orgId?: string) {
  const feedbackWhere = orgId ? { project: { org_id: orgId } } : {};

  const [total, open, inProgress, resolved, closed, byCategory, bySource] =
    await Promise.all([
      prisma.feedback.count({ where: { ...feedbackWhere, deleted_at: null } }),
      prisma.feedback.count({ where: { ...feedbackWhere, status: 'open', deleted_at: null } }),
      prisma.feedback.count({ where: { ...feedbackWhere, status: 'in_progress', deleted_at: null } }),
      prisma.feedback.count({ where: { ...feedbackWhere, status: 'resolved', deleted_at: null } }),
      prisma.feedback.count({ where: { ...feedbackWhere, status: 'closed', deleted_at: null } }),
      prisma.feedback.groupBy({ by: ['category'], where: { ...feedbackWhere, deleted_at: null }, _count: { category: true } }),
      prisma.feedback.groupBy({ by: ['source'], where: { ...feedbackWhere, deleted_at: null }, _count: { source: true } }),
    ]);

  // Build weekly and monthly stats using ORM (portable across databases)
  const recentFeedback = await prisma.feedback.findMany({
    where: { ...feedbackWhere, deleted_at: null, created_at: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
    select: { created_at: true },
  });

  const weekMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  for (const f of recentFeedback) {
    const d = new Date(f.created_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
  }

  return {
    total, open, in_progress: inProgress, resolved, closed,
    by_category: Object.fromEntries(byCategory.map((r) => [r.category, r._count.category])),
    by_week: [...weekMap.entries()].map(([week, count]) => ({ week, count })),
    by_source: Object.fromEntries(bySource.map((r) => [r.source, r._count.source])),
    by_month: [...monthMap.entries()].map(([month, count]) => ({ month, count })),
  };
}
```

- [ ] **Step 2: Update Stats type in admin**

Modify `packages/admin/src/types/index.ts`:

```typescript
export type Stats = {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  by_category: Record<string, number>;
  by_week: WeekStat[];
  by_source: Record<string, number>;
  by_month: { month: string; count: number }[];
};
```

Also update `FeedbackCategory` to be dynamic since categories are now configurable:
```typescript
export type FeedbackCategory = string;
```

- [ ] **Step 3: Create StatusFunnelChart component**

Add to `packages/admin/src/pages/Dashboard.tsx` (after WeeklyTrendChart):

```typescript
function StatusFunnelChart({ stats }: { stats: DashboardStats }) {
  const stages = [
    { key: 'total', label: '总反馈', color: '#6b7280', count: stats.total },
    { key: 'open', label: '待处理', color: '#f59e0b', count: stats.open },
    { key: 'in_progress', label: '处理中', color: '#3b82f6', count: stats.in_progress },
    { key: 'resolved', label: '已解决', color: '#10b981', count: stats.resolved },
    { key: 'closed', label: '已关闭', color: '#6b7280', count: stats.closed },
  ];
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">状态流转漏斗</h2>
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.key} className="flex items-center gap-3">
            <span className="w-16 text-xs font-medium text-gray-600 dark:text-gray-400">{stage.label}</span>
            <div className="flex-1 h-6 overflow-hidden rounded bg-surface-2 dark:bg-gray-700">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${(stage.count / maxCount) * 100}%`, backgroundColor: stage.color }}
              />
            </div>
            <span className="w-8 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">{stage.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create MonthlyTrendChart component**

```typescript
function MonthlyTrendChart({ data }: { data: { month: string; count: number }[] }) {
  const items = data.slice(-12);
  if (items.length < 2) return null;
  const maxCount = Math.max(...items.map(d => d.count), 1);
  const chartW = 100, chartH = 40, padX = 0, padY = 4;
  const innerW = chartW - padX * 2, innerH = chartH - padY * 2;

  const points = items.map((d, i) => {
    const x = padX + (i / (items.length - 1)) * innerW;
    const y = padY + innerH - (d.count / maxCount) * innerH;
    return `${x},${y}`;
  });

  const areaPath = `M${points[0]} ${points.slice(1).map(p => `L${p}`).join(' ')} L${padX + innerW},${chartH} L${padX},${chartH} Z`;

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">月度趋势</h2>
      <svg viewBox={`0 0 ${chartW} ${chartH + 12}`} className="w-full h-32" preserveAspectRatio="none">
        <defs>
          <linearGradient id="monthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#monthFill)" />
        <polyline points={points.join(' ')} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {items.map((d, i) => {
          const x = padX + (i / (items.length - 1)) * innerW;
          const y = padY + innerH - (d.count / maxCount) * innerH;
          return <circle key={i} cx={x} cy={y} r="1.5" fill="#059669" />;
        })}
        {items.map((d, i) => {
          const x = padX + (i / (items.length - 1)) * innerW;
          return <text key={i} x={x} y={chartH + 10} textAnchor="middle" fontSize="3" fill="#9ca3af">{d.month}</text>;
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Update Dashboard page to use new charts**

Modify `packages/admin/src/pages/Dashboard.tsx`. Add imports for new charts and update the layout.

First, add the new type import:
```typescript
import type { Stats as DashboardStats } from '@/types';
```

Then replace the section after stat cards (the `<div className="grid gap-6 lg:grid-cols-3">` block and the category distribution) with:

```tsx
{stats.by_week?.length > 0 && <WeeklyTrendChart data={stats.by_week} />}
<StatusFunnelChart stats={stats} />
<div className="grid gap-6 lg:grid-cols-2">
  {stats.by_month !== undefined && stats.by_month.length > 1 && <MonthlyTrendChart data={stats.by_month} />}
  {stats.by_source && Object.keys(stats.by_source).length > 0 && (
    <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">来源分布</h2>
      <div className="space-y-3">
        {Object.entries(stats.by_source).map(([source, count]) => (
          <div key={source} className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium text-gray-600 dark:text-gray-400">{source}</span>
            <div className="flex-1 h-4 overflow-hidden rounded bg-surface-2 dark:bg-gray-700">
              <div className="h-full rounded bg-brand-500" style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }} />
            </div>
            <span className="w-8 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )}
</div>
```

Also update the `CATEGORY_LABELS` to be a function that handles dynamic categories:
```typescript
const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug', feature: '功能', performance: '性能', ui: 'UI', other: '其他',
};
// Falls back to the raw category name if not in the map (handles custom categories)
```

- [ ] **Step 6: Run typecheck**

Run: `cd packages/admin && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/admin/src/pages/Dashboard.tsx packages/admin/src/types/index.ts packages/server/src/services/feedback.ts
git commit -m "feat: enhance dashboard with funnel, monthly trend, and source distribution charts"
```

---

## Task 7: Webhook Management UI (Logs & Retry)

**Files:**
- Modify: `packages/admin/src/pages/Webhooks.tsx`
- Create: `packages/admin/src/components/WebhookLogs.tsx`

- [ ] **Step 1: Add WebhookLog type to admin types**

Modify `packages/admin/src/types/index.ts`:

```typescript
export type WebhookLog = {
  id: string;
  webhook_id: string;
  event: string;
  payload: string;
  status_code: number | null;
  success: boolean;
  attempts: number;
  error: string | null;
  created_at: string;
};
```

- [ ] **Step 2: Create WebhookLogs component**

Create `packages/admin/src/components/WebhookLogs.tsx`:

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import type { WebhookLog, PaginatedResponse } from '@/types';

export function WebhookLogs({ webhookId, projectId }: { webhookId: string; projectId: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['webhook-logs', webhookId, page],
    queryFn: () => apiRequest<PaginatedResponse<WebhookLog>>(
      `/org/projects/${projectId}/webhooks/${webhookId}/logs?page=${page}&page_size=10`
    ),
    enabled: !!webhookId,
  });

  if (isLoading) return <p className="text-sm text-gray-400">加载中...</p>;
  if (!data?.items.length) return <p className="text-sm text-gray-400 py-4 text-center">暂无日志</p>;

  return (
    <div className="mt-3 space-y-2">
      {data.items.map((log) => (
        <div key={log.id} className="rounded-lg border border-surface-3 px-4 py-3 text-xs">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center rounded px-2 py-0.5 font-medium ${log.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {log.success ? '成功' : '失败'}
            </span>
            <span className="text-gray-400">{new Date(log.created_at).toLocaleString('zh-CN')}</span>
          </div>
          <div className="mt-1 text-gray-600">
            <span className="font-medium">{log.event}</span>
            {log.status_code && <span className="ml-2 text-gray-400">HTTP {log.status_code}</span>}
            <span className="ml-2 text-gray-400">尝试 {log.attempts} 次</span>
          </div>
          {log.error && <p className="mt-1 text-red-600">{log.error}</p>}
        </div>
      ))}
      {data.total > 10 && (
        <div className="flex justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">上一页</button>
          <span className="px-2 text-xs text-gray-500">{page} / {Math.ceil(data.total / 10)}</span>
          <button disabled={page >= Math.ceil(data.total / 10)} onClick={() => setPage(p => p + 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Integrate logs into Webhooks page**

Modify `packages/admin/src/pages/Webhooks.tsx`. Add state for expanded webhook:

```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);
```

Add a "查看日志" button in each webhook card (after the 测试 button):

```tsx
<button
  onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}
  className="text-xs text-gray-500 hover:underline"
>
  {expandedId === wh.id ? '收起日志' : '查看日志'}
</button>
```

Add below the card content, conditionally:

```tsx
{expandedId === wh.id && <WebhookLogs webhookId={wh.id} projectId={projectId} />}
```

- [ ] **Step 4: Run typecheck**

Run: `cd packages/admin && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add packages/admin/src/pages/Webhooks.tsx packages/admin/src/components/WebhookLogs.tsx packages/admin/src/types/index.ts
git commit -m "feat: add webhook delivery logs view in admin UI"
```

---

## Task 8: Feedback Merge Enhancement

**Files:**
- Modify: `packages/server/src/services/merge.ts`
- Modify: `packages/server/src/routes/admin.ts:162`
- Create: `packages/server/src/services/__tests__/merge.test.ts`

- [ ] **Step 1: Write failing tests for enhanced merge**

Create `packages/server/src/services/__tests__/merge.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTx = {
  feedback: {
    findUnique: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  vote: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
};

const mockPrisma = {
  $transaction: vi.fn((fn) => fn(mockTx)),
  feedback: { findUnique: vi.fn(), update: vi.fn() },
  vote: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { mergeFeedback, previewMerge } = await import('../merge.js');

describe('Merge Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mergeFeedback merges votes and closes source', async () => {
    mockTx.feedback.findUnique
      .mockResolvedValueOnce({ id: 'src', merged_into_id: null, project_id: 'p1' })
      .mockResolvedValueOnce({ id: 'tgt', project_id: 'p1' });
    mockTx.vote.findMany
      .mockResolvedValueOnce([{ id: 'v1', email: 'a@x.com' }])
      .mockResolvedValueOnce([{ id: 'v2', email: 'a@x.com' }, { id: 'v3', email: 'b@x.com' }]);

    await mergeFeedback('src', 'tgt');
    expect(mockTx.feedback.update).toHaveBeenCalledWith({
      where: { id: 'src' },
      data: { merged_into_id: 'tgt', status: 'closed' },
    });
  });

  it('mergePreview returns vote transfer count', async () => {
    mockPrisma.feedback.findUnique
      .mockResolvedValueOnce({ id: 'src', title: 'Source', merged_into_id: null, project_id: 'p1' })
      .mockResolvedValueOnce({ id: 'tgt', title: 'Target', project_id: 'p1' });
    mockPrisma.vote.findMany
      .mockResolvedValueOnce([{ id: 'v1', email: 'a@x.com' }])
      .mockResolvedValueOnce([{ id: 'v2', email: 'a@x.com' }]);

    const result = await previewMerge('src', 'tgt');
    expect(result).toEqual({ sourceId: 'src', targetId: 'tgt', votesToTransfer: 0, votesToDeduplicate: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/services/__tests__/merge.test.ts`
Expected: FAIL — `merge.js` does not exist (or lacks `previewMerge`)

- [ ] **Step 3: Implement merge service**

Create `packages/server/src/services/merge.ts`:

```typescript
import { prisma } from '../db/client.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export async function mergeFeedback(sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new ValidationError('不能将反馈合并到自身');

  const result = await prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.feedback.findUnique({ where: { id: sourceId } }),
      tx.feedback.findUnique({ where: { id: targetId } }),
    ]);

    if (!source) throw new NotFoundError('源反馈不存在');
    if (!target) throw new NotFoundError('目标反馈不存在');
    if (source.project_id !== target.project_id) {
      throw new ValidationError('只能合并同一项目内的反馈');
    }
    if (source.merged_into_id) {
      throw new ValidationError('该反馈已被合并到其他反馈');
    }

    const [sourceVotes, targetVotes] = await Promise.all([
      tx.vote.findMany({ where: { feedback_id: sourceId } }),
      tx.vote.findMany({ where: { feedback_id: targetId }, select: { email: true } }),
    ]);

    const targetEmails = new Set(targetVotes.map((v) => v.email));
    const toTransfer = sourceVotes.filter((v) => !targetEmails.has(v.email));
    const toDelete = sourceVotes.filter((v) => targetEmails.has(v.email));

    if (toDelete.length > 0) {
      await tx.vote.deleteMany({ where: { id: { in: toDelete.map((v) => v.id) } } });
    }
    if (toTransfer.length > 0) {
      await tx.vote.updateMany({
        where: { id: { in: toTransfer.map((v) => v.id) } },
        data: { feedback_id: targetId },
      });
    }

    await tx.feedback.update({
      where: { id: sourceId },
      data: { merged_into_id: targetId, status: 'closed' },
    });

    return target;
  });

  return { merged: true, source_id: sourceId, target_id: targetId };
}

export async function previewMerge(sourceId: string, targetId: string) {
  const [source, target] = await Promise.all([
    prisma.feedback.findUnique({ where: { id: sourceId }, select: { id: true, title: true, merged_into_id: true, project_id: true } }),
    prisma.feedback.findUnique({ where: { id: targetId }, select: { id: true, title: true, project_id: true } }),
  ]);

  if (!source) throw new NotFoundError('源反馈不存在');
  if (!target) throw new NotFoundError('目标反馈不存在');
  if (source.project_id !== target.project_id) {
    throw new ValidationError('只能合并同一项目内的反馈');
  }

  const [sourceVotes, targetVotes] = await Promise.all([
    prisma.vote.findMany({ where: { feedback_id: sourceId }, select: { email: true } }),
    prisma.vote.findMany({ where: { feedback_id: targetId }, select: { email: true } }),
  ]);

  const targetEmails = new Set(targetVotes.map((v) => v.email));
  const toTransfer = sourceVotes.filter((v) => !targetEmails.has(v.email));
  const toDeduplicate = sourceVotes.filter((v) => targetEmails.has(v.email));

  return {
    source_id: sourceId,
    target_id: targetId,
    source_title: source.title,
    target_title: target.title,
    votes_to_transfer: toTransfer.length,
    votes_to_deduplicate: toDeduplicate.length,
  };
}
```

- [ ] **Step 4: Add preview endpoint to routes**

Modify `packages/server/src/routes/admin.ts`. Add after the existing merge route:

```typescript
adminRouter.post('/feedback/:id/merge-preview', adminAuth, async (req, res, next) => {
  try {
    const { target_id } = req.body;
    if (!target_id) throw new ValidationError('目标反馈 ID 不能为空');
    const result = await previewMerge(String(req.params.id), target_id);
    success(res, result);
  } catch (err) {
    next(err);
  }
});
```

Add import at top:
```typescript
import { mergeFeedback, previewMerge } from '../services/merge.js';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/services/merge.ts packages/server/src/routes/admin.ts packages/server/src/services/__tests__/merge.test.ts
git commit -m "feat: add merge preview endpoint and enhanced vote deduplication"
```

---

## Task 9: Custom Categories Admin UI

**Files:**
- Create: `packages/admin/src/pages/Categories.tsx`
- Modify: `packages/admin/src/App.tsx`
- Modify: `packages/admin/src/components/Layout.tsx`

- [ ] **Step 1: Create Categories management page**

Create `packages/admin/src/pages/Categories.tsx`:

```typescript
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';
import type { CategoryConfig } from '@/types';

export function Categories() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', projectId],
    queryFn: () => apiRequest<CategoryConfig[]>(`/org/projects/${projectId}/categories`),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest(`/org/projects/${projectId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', projectId] });
      setName('');
      toast.show('分类添加成功');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '添加失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/org/projects/${projectId}/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', projectId] });
      toast.show('分类已删除');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  if (isLoading) return <p className="text-sm text-gray-400">加载中...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">自定义分类</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(); }}
        className="flex gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="分类名称"
          className="flex-1 rounded-lg border border-surface-3 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          required
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded border-0"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          添加
        </button>
      </form>
      <div className="space-y-2">
        {categories?.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 rounded-xl border border-surface-3 bg-surface-0 px-5 py-4">
            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} />
            <span className="flex-1 text-sm font-medium text-gray-900">{cat.name}</span>
            <button
              onClick={() => deleteMutation.mutate(cat.id)}
              className="text-xs text-red-500 hover:underline"
            >
              删除
            </button>
          </div>
        ))}
        {categories?.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">
            暂无自定义分类，将使用默认分类（Bug、功能、性能、UI、其他）
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CategoryConfig type**

Modify `packages/admin/src/types/index.ts`. Add:

```typescript
export type CategoryConfig = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
};
```

- [ ] **Step 3: Add route in App.tsx**

Modify `packages/admin/src/App.tsx`:

```typescript
import { Categories } from '@/pages/Categories';
```

Add route:
```tsx
<Route path="/projects/:projectId/categories" element={<Categories />} />
```

- [ ] **Step 4: Run typecheck**

Run: `cd packages/admin && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add packages/admin/src/pages/Categories.tsx packages/admin/src/App.tsx packages/admin/src/types/index.ts
git commit -m "feat: add custom categories management page in admin"
```

---

## Task 10: API Documentation (OpenAPI)

**Files:**
- Create: `packages/server/src/routes/swagger.ts`
- Modify: `packages/server/src/app.ts`
- Install: `swagger-ui-express`, `@types/swagger-ui-express`
- Create: `packages/server/src/openapi.ts`

- [ ] **Step 1: Install dependencies**

Run: `cd packages/server && pnpm add swagger-ui-express && pnpm add -D @types/swagger-ui-express`
Expected: Dependencies added

- [ ] **Step 2: Create OpenAPI spec**

Create `packages/server/src/openapi.ts`:

```typescript
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Nexus Feedback API',
    version: '1.0.0',
    description: '用户反馈收集平台 API',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          code: { type: 'integer', example: 40001 },
          message: { type: 'string', example: '参数错误' },
        },
      },
      Feedback: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          source: { type: 'string' },
          vote_count: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/feedback': {
      post: {
        summary: '提交反馈',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'content', 'category'],
                properties: {
                  title: { type: 'string', maxLength: 200 },
                  content: { type: 'string', maxLength: 5000 },
                  category: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                  contact: { type: 'string', format: 'email' },
                  source: { type: 'string', enum: ['api', 'widget', 'submit-page'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '创建成功' },
          '401': { description: '未授权' },
          '429': { description: '请求过于频繁' },
        },
      },
    },
    '/public/{projectSlug}/feedback': {
      post: {
        summary: '通过公开看板提交反馈',
        parameters: [{ name: 'projectSlug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'content', 'category'],
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  category: { type: 'string' },
                  priority: { type: 'string' },
                  contact: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '创建成功' },
          '400': { description: '参数错误' },
        },
      },
    },
    '/health': {
      get: {
        summary: '健康检查',
        responses: { '200': { description: '服务正常' } },
      },
    },
  },
};
```

- [ ] **Step 3: Create swagger route**

Create `packages/server/src/routes/swagger.ts`:

```typescript
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from '../openapi.js';

export const swaggerRouter = Router();
swaggerRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Nexus Feedback API',
}));
swaggerRouter.get('/openapi.json', (_req, res) => {
  res.json(openapiSpec);
});
```

- [ ] **Step 4: Register swagger route in app.ts**

Modify `packages/server/src/app.ts`:

```typescript
import { swaggerRouter } from './routes/swagger.js';
```

Add (before error handler):
```typescript
app.use('/api/v1', swaggerRouter);
```

- [ ] **Step 5: Run server and verify docs load**

Run: `cd packages/server && npx tsx src/index.ts`
Expected: Server starts

Run: `curl http://localhost:3000/api/v1/openapi.json`
Expected: JSON spec returned

Run: `curl -o /dev/null -s -w "%{http_code}" http://localhost:3000/api/v1/docs`
Expected: 200

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/openapi.ts packages/server/src/routes/swagger.ts packages/server/src/app.ts packages/server/package.json packages/server/pnpm-lock.yaml
git commit -m "feat: add OpenAPI documentation with Swagger UI at /api/v1/docs"
```

---

## Task 11: Test Coverage Expansion

**Files:**
- Create: `packages/server/src/services/__tests__/notification.test.ts`
- Create: `packages/server/src/services/__tests__/webhook.test.ts`
- Create: `packages/server/src/services/__tests__/notificationPreference.test.ts`

- [ ] **Step 1: Write tests for notification service**

Create `packages/server/src/services/__tests__/notification.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  prisma: {
    feedback: { findUnique: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
    member: { findMany: vi.fn() },
  },
}));

vi.mock('../email.js', () => ({
  sendEmail: vi.fn(),
  sendBatchEmails: vi.fn(),
}));

const mockPrisma = (await import('../../db/client.js')).prisma as Record<string, ReturnType<typeof vi.fn>>;
const { sendBatchEmails } = await import('../email.js');
const { notifyStatusChange, notifyNewFeedback, notifyReply } = await import('../notification.js');

describe('Notification Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('notifyStatusChange sends emails to voters and contact', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({
      id: 'fb_1', title: 'Test', project_id: 'p1',
      contact: 'user@example.com', votes: [{ email: 'voter@example.com' }],
    });
    mockPrisma.notificationPreference.findMany.mockResolvedValue([]);

    await notifyStatusChange('fb_1', 'resolved');
    expect(sendBatchEmails).toHaveBeenCalledWith(
      ['user@example.com', 'voter@example.com'],
      expect.any(String),
      expect.any(String),
    );
  });

  it('notifyStatusChange respects opt-out preferences', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({
      id: 'fb_1', title: 'Test', project_id: 'p1',
      contact: 'user@example.com', votes: [],
    });
    mockPrisma.notificationPreference.findMany.mockResolvedValue([
      { email: 'user@example.com', status_updates: false },
    ]);

    await notifyStatusChange('fb_1', 'resolved');
    expect(sendBatchEmails).not.toHaveBeenCalled();
  });

  it('notifyReply sends email to feedback contact only', async () => {
    mockPrisma.feedback.findUnique.mockResolvedValue({
      id: 'fb_1', title: 'Test', contact: 'user@example.com',
    });

    await notifyReply('fb_1', 'Reply content');
    expect(sendBatchEmails).toHaveBeenCalledWith(
      ['user@example.com'],
      expect.stringContaining('Test'),
      expect.stringContaining('Reply content'),
    );
  });
});
```

- [ ] **Step 2: Write tests for webhook service**

Create `packages/server/src/services/__tests__/webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  webhook: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  webhookLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { listWebhooks, createWebhook, deleteWebhook, listWebhookLogs } = await import('../webhook.js');

describe('Webhook Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listWebhooks returns paginated webhooks', async () => {
    mockPrisma.webhook.findMany.mockResolvedValue([{ id: 'wh_1', url: 'https://example.com' }]);
    mockPrisma.webhook.count.mockResolvedValue(1);
    const result = await listWebhooks('p1', { page: 1, pageSize: 20, skip: 0, take: 20 });
    expect(result.items).toHaveLength(1);
  });

  it('createWebhook strips secret from response', async () => {
    mockPrisma.webhook.create.mockResolvedValue({ id: 'wh_1', url: 'https://example.com', secret: '' });
    const result = await createWebhook('p1', 'https://example.com', ['feedback.created']);
    expect(result).not.toHaveProperty('secret');
  });

  it('listWebhookLogs returns paginated logs', async () => {
    mockPrisma.webhookLog.findMany.mockResolvedValue([]);
    mockPrisma.webhookLog.count.mockResolvedValue(0);
    const result = await listWebhookLogs('wh_1', { page: 1, pageSize: 20, skip: 0, take: 20 });
    expect(result.items).toEqual([]);
  });
});
```

- [ ] **Step 3: Write tests for notification preferences**

Create `packages/server/src/services/__tests__/notificationPreference.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  notificationPreference: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { getPreference, updatePreference, listPreferences, deletePreference } =
  await import('../notificationPreference.js');

describe('NotificationPreference Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPreference creates default if not exists', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    mockPrisma.notificationPreference.create.mockResolvedValue({
      id: 'np_1', email: 'a@x.com', project_id: 'p1', status_updates: true, weekly_digest: true,
    });
    const result = await getPreference('a@x.com', 'p1');
    expect(result.status_updates).toBe(true);
  });

  it('updatePreference updates existing record', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ id: 'np_1' });
    mockPrisma.notificationPreference.update.mockResolvedValue({
      id: 'np_1', status_updates: false,
    });
    const result = await updatePreference('a@x.com', 'p1', { status_updates: false });
    expect(result.status_updates).toBe(false);
  });

  it('deletePreference throws if not found', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    await expect(deletePreference('a@x.com', 'p1')).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass (40 original + 10+ new = 50+ total)

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/__tests__/notification.test.ts packages/server/src/services/__tests__/webhook.test.ts packages/server/src/services/__tests__/notificationPreference.test.ts
git commit -m "test: add coverage for notification, webhook, and preference services"
```

---

## Task 12: Final Integration Check

**Files:**
- (none — verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd /root && pnpm test`
Expected: All tests pass across all packages

- [ ] **Step 2: Run typecheck on all packages**

Run: `cd /root && pnpm -r run typecheck`
Expected: No type errors

- [ ] **Step 3: Run build**

Run: `cd /root && pnpm build`
Expected: All packages build successfully

- [ ] **Step 4: Verify migrations**

Run: `cd packages/server && npx prisma migrate status`
Expected: All migrations applied

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final integration fixes" --allow-empty
```
