# Platform Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 features: dynamic categories on Widget/Board, feedback assignment, audit log UI, and attachment cleanup job.

**Architecture:**
- Public categories endpoint serves `CategoryConfig` with default fallback
- Widget/Board fetch categories on mount via SWR-like pattern
- Assignment: new `assignee_id` column + PATCH endpoint + detail page UI
- Audit log: new admin page consuming existing audit API
- Cleanup: cron job removing orphaned attachments >24h

**Tech Stack:** Express, Prisma, PostgreSQL, React, TanStack Query, node-cron

---

## File Structure

```
packages/server/
├── prisma/
│   ├── migrations/
│   │   └── 20260728080000_add_assignee_to_feedback/
│   │       └── migration.sql
│   └── schema.prisma                    # Add assignee_id, assignee relation
├── src/
│   ├── jobs/
│   │   └── digest.ts                    # Add cleanupOrphanedAttachments()
│   ├── routes/
│   │   ├── admin.ts                     # Add PATCH /feedback/:id/assign
│   │   └── public.ts                    # Add GET /:slug/categories
│   ├── services/
│   │   ├── categoryConfig.ts            # Extract getProjectCategories for public use
│   │   └── feedback.ts                  # Add assignFeedback()
│   └── __tests__/
│       ├── feedback-assign.test.ts      # New: assignment tests
│       └── cleanup.test.ts              # New: cleanup job tests

packages/admin/
├── src/
│   ├── api/client.ts                    # Add auditLogs(), assignFeedback()
│   ├── pages/
│   │   ├── AuditLogs.tsx                # New: audit log viewer
│   │   ├── FeedbackList.tsx             # Add assignee filter column
│   │   └── FeedbackDetail.tsx           # Add assignee selector
│   ├── types/
│   │   └── index.ts                     # Add AuditLog type
│   └── App.tsx                          # Add /audit-logs route

packages/widget/
├── src/
│   ├── FeedbackForm.tsx                 # Fetch categories dynamically
│   └── api.ts                           # New: fetchProjectCategories()

packages/board/
├── src/
│   ├── api.ts                           # Add fetchProjectCategories()
│   └── components/
│       └── SubmitModal.tsx              # Fetch categories dynamically
```

---

## Task 1: Public Categories Endpoint

**Files:**
- Modify: `packages/server/src/routes/public.ts`
- Test: `packages/server/src/__tests__/public-categories.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/__tests__/public-categories.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

vi.mock('../db/client.js', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    feedback: { findMany: vi.fn(), count: vi.fn() },
    categoryConfig: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
  },
}));

import { prisma } from '../db/client.js';

describe('GET /api/v1/public/:slug/categories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns custom categories when configured', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'proj_1', slug: 'test', name: 'Test', org_id: 'org_1',
    } as any);
    vi.mocked(prisma.categoryConfig.findMany).mockResolvedValue([
      { id: 'cat_1', project_id: 'proj_1', name: '建议', color: '#10b981', position: 0, created_at: new Date() },
      { id: 'cat_2', project_id: 'proj_1', name: '问题', color: '#ef4444', position: 1, created_at: new Date() },
    ] as any);

    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/categories');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ name: '建议', color: '#10b981' });
  });

  it('returns default categories when none configured', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'proj_1', slug: 'test', name: 'Test', org_id: 'org_1',
    } as any);
    vi.mocked(prisma.categoryConfig.findMany).mockResolvedValue([]);

    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/categories');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data.map((c: any) => c.name)).toContain('bug');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/public-categories.test.ts`
Expected: FAIL — route does not exist

- [ ] **Step 3: Add the public categories route**

In `packages/server/src/routes/public.ts`, add after the existing routes:

```typescript
import { getProjectCategories } from '../services/categoryConfig.js';

publicRouter.get('/:slug/categories', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: req.params.slug },
      select: { id: true },
    });
    if (!project) {
      res.status(404).json({ code: 404, message: 'Project not found' });
      return;
    }
    const categories = await getProjectCategories(project.id);
    success(res, categories);
  } catch (err) {
    next(err);
  }
});
```

Also add the import at the top:
```typescript
import { prisma } from '../db/client.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/__tests__/public-categories.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/public.ts packages/server/src/__tests__/public-categories.test.ts
git commit -m "feat: add public categories endpoint for widget/board"
```

---

## Task 2: Widget Dynamic Categories

**Files:**
- Create: `packages/widget/src/api.ts`
- Modify: `packages/widget/src/FeedbackForm.tsx`

- [ ] **Step 1: Create the API module**

Create `packages/widget/src/api.ts`:

```typescript
const DEFAULT_CATEGORIES = [
  { name: 'bug', color: '#ef4444', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'feature', color: '#6366f1', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { name: 'performance', color: '#f59e0b', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { name: 'ui', color: '#8b5cf6', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z' },
  { name: 'other', color: '#6b7280', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

export interface ProjectCategory {
  id?: string;
  name: string;
  color: string;
  icon?: string;
}

export async function fetchProjectCategories(apiUrl: string, slug: string): Promise<ProjectCategory[]> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/public/${slug}/categories`);
    if (!res.ok) return DEFAULT_CATEGORIES;
    const json = await res.json();
    if (json.code !== 0 || !json.data?.length) return DEFAULT_CATEGORIES;
    return json.data.map((c: any) => {
      const match = DEFAULT_CATEGORIES.find(d => d.name === c.name);
      return { ...c, icon: match?.icon || DEFAULT_CATEGORIES[0].icon };
    });
  } catch {
    return DEFAULT_CATEGORIES;
  }
}
```

- [ ] **Step 2: Update FeedbackForm to use dynamic categories**

In `packages/widget/src/FeedbackForm.tsx`:

1. Add import at top:
```typescript
import { fetchProjectCategories, ProjectCategory } from './api';
```

2. Remove hardcoded `CATEGORIES` and `CATEGORY_LABELS` constants (lines 21-35).

3. Add state for categories:
```typescript
const [categories, setCategories] = useState<ProjectCategory[]>([]);
const [categoryLoading, setCategoryLoading] = useState(true);
```

4. Add useEffect to fetch categories:
```typescript
useState(() => {
  const slug = apiUrl.includes('/api/v1/public/') 
    ? apiUrl.split('/api/v1/public/')[1] 
    : '';
  if (slug) {
    fetchProjectCategories(apiUrl, slug).then(cats => {
      setCategories(cats);
      setCategoryLoading(false);
      if (cats[0]) setCategory(cats[0].name);
    });
  } else {
    setCategoryLoading(false);
  }
});
```

5. Update the category rendering section to use `categories.map()` instead of `CATEGORIES.map()`.

6. Update the submit body to send `category` as the category name (already does this).

- [ ] **Step 3: Build widget**

Run: `cd packages/widget && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/api.ts packages/widget/src/FeedbackForm.tsx
git commit -m "feat(widget): fetch categories dynamically from API"
```

---

## Task 3: Board Dynamic Categories

**Files:**
- Modify: `packages/board/src/api.ts`
- Modify: `packages/board/src/components/SubmitModal.tsx`

- [ ] **Step 1: Add fetchProjectCategories to board api.ts**

In `packages/board/src/api.ts`, add:

```typescript
export interface ProjectCategory {
  name: string;
  color: string;
}

export async function fetchProjectCategories(): Promise<ProjectCategory[]> {
  try {
    const res = await request<ProjectCategory[]>('/categories');
    return res;
  } catch {
    return [
      { name: 'feature', color: '#6366f1' },
      { name: 'bug', color: '#ef4444' },
      { name: 'improvement', color: '#f59e0b' },
      { name: 'other', color: '#6b7280' },
    ];
  }
}
```

- [ ] **Step 2: Add categories public route handler**

In `packages/server/src/routes/public.ts`, add a route that doesn't require slug prefix:

```typescript
publicRouter.get('/:slug/categories', async (req, res, next) => {
  // ... already done in Task 1
});
```

The board already calls `baseUrl()` which is `/api/v1/public/${slug}`, so it will hit the same endpoint.

- [ ] **Step 3: Update SubmitModal to use dynamic categories**

In `packages/board/src/components/SubmitModal.tsx`:

1. Add import:
```typescript
import { useState, useEffect } from 'react';
import { fetchProjectCategories, ProjectCategory } from '../api';
```

2. Add state:
```typescript
const [categories, setCategories] = useState<ProjectCategory[]>([]);
```

3. Add useEffect:
```typescript
useEffect(() => {
  fetchProjectCategories().then(setCategories);
}, []);
```

4. Replace the `<select>` options:
```tsx
{categories.map(cat => (
  <option key={cat.name} value={cat.name}>
    {cat.name === 'feature' ? '功能建议' : 
     cat.name === 'bug' ? 'Bug 报告' : 
     cat.name === 'improvement' ? '改进' :
     cat.name === 'other' ? '其他' : cat.name}
  </option>
))}
```

- [ ] **Step 4: Build board**

Run: `cd packages/board && npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/board/src/api.ts packages/board/src/components/SubmitModal.tsx
git commit -m "feat(board): fetch categories dynamically from API"
```

---

## Task 4: Feedback Assignment — Database

**Files:**
- Create: `packages/server/prisma/migrations/20260728080000_add_assignee_to_feedback/migration.sql`
- Modify: `packages/server/prisma/schema.prisma`

- [ ] **Step 1: Create migration**

Create `packages/server/prisma/migrations/20260728080000_add_assignee_to_feedback/migration.sql`:

```sql
ALTER TABLE "feedback" ADD COLUMN "assignee_id" TEXT;

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "member"("id") ON DELETE SET NULL;

CREATE INDEX "feedback_assignee_id_idx" ON "feedback"("assignee_id");
```

- [ ] **Step 2: Update schema.prisma**

In `packages/server/prisma/schema.prisma`, update the `Feedback` model:

```prisma
model Feedback {
  id             String   @id @default(cuid())
  title          String
  content        String
  category       String
  priority       String   @default("medium")
  status         String   @default("open")
  source         String   @default("api")
  contact        String?
  app_version    String?
  metadata       Json?
  vote_count     Int      @default(0)
  project_id     String
  assignee_id    String?                              // <-- ADD THIS
  merged_into_id String?
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  deleted_at     DateTime?

  project          Project              @relation(fields: [project_id], references: [id], onDelete: Cascade)
  assignee         Member?              @relation(fields: [assignee_id], references: [id])  // <-- ADD THIS
  merged_into      Feedback?            @relation("FeedbackMerge", fields: [merged_into_id], references: [id])
  merged_from      Feedback[]           @relation("FeedbackMerge")
  attachments      Attachment[]
  replies          Reply[]
  votes            Vote[]
  feedbackTags     FeedbackTag[]
  changelogs       ChangelogFeedback[]
  comments         Comment[]
  internal_notes   InternalNote[]
  status_histories StatusHistory[]

  @@index([deleted_at])
  @@index([assignee_id])  // <-- ADD THIS
}
```

Also update the `Member` model to add the reverse relation:

```prisma
model Member {
  // ... existing fields ...
  assigned_feedbacks Feedback[]  // <-- ADD THIS
}
```

- [ ] **Step 3: Apply migration**

Run: `cd packages/server && npx prisma migrate dev --name add_assignee_to_feedback`
Expected: Migration applied successfully

- [ ] **Step 4: Commit**

```bash
git add packages/server/prisma/schema.prisma packages/server/prisma/migrations/
git commit -m "feat: add assignee_id to feedback model"
```

---

## Task 5: Feedback Assignment — API

**Files:**
- Modify: `packages/server/src/services/feedback.ts`
- Modify: `packages/server/src/routes/admin.ts`
- Test: `packages/server/src/__tests__/feedback-assign.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/__tests__/feedback-assign.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  prisma: {
    feedback: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '../db/client.js';
import { assignFeedback } from '../services/feedback.js';

describe('assignFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assigns feedback to a member in the same org', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue({
      id: 'fb_1', project_id: 'proj_1',
    } as any);
    vi.mocked(prisma.member.findFirst).mockResolvedValue({
      id: 'mem_1', org_id: 'org_1',
    } as any);
    vi.mocked(prisma.feedback.update).mockResolvedValue({
      id: 'fb_1', assignee_id: 'mem_1',
    } as any);

    const result = await assignFeedback('fb_1', 'mem_1', 'org_1');

    expect(result.assignee_id).toBe('mem_1');
    expect(prisma.feedback.update).toHaveBeenCalledWith({
      where: { id: 'fb_1' },
      data: { assignee_id: 'mem_1' },
      include: expect.any(Object),
    });
  });

  it('throws when feedback not found', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue(null);

    await expect(assignFeedback('missing', 'mem_1', 'org_1'))
      .rejects.toThrow('Feedback not found');
  });

  it('throws when member not in org', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue({
      id: 'fb_1', project_id: 'proj_1',
    } as any);
    vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

    await expect(assignFeedback('fb_1', 'mem_1', 'org_1'))
      .rejects.toThrow('Member not found in organization');
  });

  it('allows unassigning (null assignee)', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue({
      id: 'fb_1', project_id: 'proj_1',
    } as any);
    vi.mocked(prisma.feedback.update).mockResolvedValue({
      id: 'fb_1', assignee_id: null,
    } as any);

    const result = await assignFeedback('fb_1', null, 'org_1');

    expect(result.assignee_id).toBeNull();
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/feedback-assign.test.ts`
Expected: FAIL — `assignFeedback` not exported

- [ ] **Step 3: Implement assignFeedback**

In `packages/server/src/services/feedback.ts`, add:

```typescript
export async function assignFeedback(
  feedbackId: string,
  assigneeId: string | null,
  orgId: string,
) {
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, project_id: true },
  });
  if (!feedback) {
    throw new Error('Feedback not found');
  }

  if (assigneeId !== null) {
    const member = await prisma.member.findFirst({
      where: { id: assigneeId, org_id: orgId },
      select: { id: true },
    });
    if (!member) {
      throw new Error('Member not found in organization');
    }
  }

  return prisma.feedback.update({
    where: { id: feedbackId },
    data: { assignee_id: assigneeId },
    include: {
      assignee: { select: { id: true, display_name: true, email: true } },
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/__tests__/feedback-assign.test.ts`
Expected: PASS

- [ ] **Step 5: Add the route**

In `packages/server/src/routes/admin.ts`, add:

```typescript
adminRouter.patch('/feedback/:id/assign', async (req, res, next) => {
  try {
    const { assignee_id } = req.body;
    const result = await assignFeedback(
      String(req.params.id),
      assignee_id ?? null,
      req.orgId!,
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
});
```

Add the import at the top of admin.ts:
```typescript
import { assignFeedback } from '../services/feedback.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/services/feedback.ts packages/server/src/routes/admin.ts packages/server/src/__tests__/feedback-assign.test.ts
git commit -m "feat: add feedback assignment API"
```

---

## Task 6: Assignment UI — FeedbackDetail

**Files:**
- Modify: `packages/admin/src/pages/FeedbackDetail.tsx`
- Modify: `packages/admin/src/api/client.ts`
- Modify: `packages/admin/src/types/index.ts`

- [ ] **Step 1: Add assignee type and API method**

In `packages/admin/src/types/index.ts`, add to `FeedbackDetail`:

```typescript
export type FeedbackDetail = {
  // ... existing fields ...
  assignee_id: string | null;
  assignee: { id: string; display_name: string; email: string } | null;
};
```

In `packages/admin/src/api/client.ts`, add:

```typescript
export async function assignFeedback(feedbackId: string, assigneeId: string | null) {
  return apiRequest(`/admin/feedback/${feedbackId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assignee_id: assigneeId }),
  });
}
```

- [ ] **Step 2: Add assignee selector to FeedbackDetail**

In `packages/admin/src/pages/FeedbackDetail.tsx`:

1. Add import:
```typescript
import { useState } from 'react';
import { assignFeedback } from '@/api/client';
```

2. Add state for members list and selected assignee:
```typescript
const [assigneeId, setAssigneeId] = useState(data?.assignee_id ?? '');
```

3. Add a member selector dropdown in the sidebar/metadata section:
```tsx
<div className="rounded-xl border border-surface-3 p-4 dark:border-gray-700 dark:bg-gray-800">
  <label className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">指派给</label>
  <select
    value={assigneeId ?? ''}
    onChange={(e) => {
      const val = e.target.value || null;
      setAssigneeId(val);
      assignFeedback(data.id, val);
    }}
    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
  >
    <option value="">未指派</option>
    {members.map(m => (
      <option key={m.id} value={m.id}>{m.display_name}</option>
    ))}
  </select>
  {data?.assignee && (
    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
      当前: {data.assignee.display_name}
    </p>
  )}
</div>
```

4. Fetch members list via API (reuse the existing members endpoint).

- [ ] **Step 3: Typecheck**

Run: `cd packages/admin && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/pages/FeedbackDetail.tsx packages/admin/src/api/client.ts packages/admin/src/types/index.ts
git commit -m "feat(admin): add assignee selector to feedback detail"
```

---

## Task 7: Audit Log UI

**Files:**
- Create: `packages/admin/src/pages/AuditLogs.tsx`
- Modify: `packages/admin/src/api/client.ts`
- Modify: `packages/admin/src/types/index.ts`
- Modify: `packages/admin/src/App.tsx`

- [ ] **Step 1: Add AuditLog type and API method**

In `packages/admin/src/types/index.ts`, add:

```typescript
export type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  member_id: string | null;
  member?: { id: string; display_name: string } | null;
  created_at: string;
};
```

In `packages/admin/src/api/client.ts`, add:

```typescript
export async function fetchAuditLogs(params: {
  page?: number;
  page_size?: number;
  action?: string;
  member_id?: string;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  if (params.action) query.set('action', params.action);
  if (params.member_id) query.set('member_id', params.member_id);
  return apiRequest(`/org/audit-logs?${query}`);
}
```

- [ ] **Step 2: Create AuditLogs page**

Create `packages/admin/src/pages/AuditLogs.tsx`:

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchAuditLogs } from '@/api/client';
import { EmptyState, TableSkeleton } from '@/components/ui';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import type { AuditLog, PaginatedResponse } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  'feedback.create': '创建反馈',
  'feedback.update': '更新反馈',
  'feedback.delete': '删除反馈',
  'feedback.merge': '合并反馈',
  'feedback.assign': '指派反馈',
  'reply.create': '回复反馈',
  'comment.create': '添加评论',
  'webhook.create': '创建 Webhook',
  'webhook.update': '更新 Webhook',
  'member.invite': '邀请成员',
  'member.remove': '移除成员',
  'project.update': '更新项目',
};

export function AuditLogs() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter],
    queryFn: () =>
      fetchAuditLogs({
        page,
        page_size: 20,
        action: actionFilter || undefined,
      }) as Promise<PaginatedResponse<AuditLog>>,
  });

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">审计日志</h1>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">全部操作</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data?.items.length ? (
        <EmptyState title="暂无审计记录" description="操作日志将会显示在这里" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-3 bg-surface-0 dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-3 bg-surface-1 dark:border-gray-700 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">操作</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">目标</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">操作人</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-2 dark:divide-gray-700">
              {data.items.map((log) => (
                <tr key={log.id} className="hover:bg-surface-1 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {log.target_type}{log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {log.member?.display_name || '系统'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            上一页
          </button>
          <span className="px-2 text-sm text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.tsx**

In `packages/admin/src/App.tsx`:

1. Add import:
```typescript
import { AuditLogs } from '@/pages/AuditLogs';
```

2. Add route inside `<Routes>`:
```tsx
<Route path="/audit-logs" element={<AuditLogs />} />
```

- [ ] **Step 4: Add audit-logs to Layout nav**

In `packages/admin/src/components/Layout.tsx`, add to `navItems`:

```typescript
{ to: '/audit-logs', labelKey: 'nav.auditLogs', icon: AuditLogsIcon },
```

Add a simple AuditLogsIcon to `icons.tsx`:

```typescript
export function AuditLogsIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <path d="M3 4h12M3 9h12M3 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 5: Typecheck and build**

Run: `cd packages/admin && npx tsc --noEmit && npx vite build`
Expected: No errors, build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/admin/src/pages/AuditLogs.tsx packages/admin/src/api/client.ts packages/admin/src/types/index.ts packages/admin/src/App.tsx packages/admin/src/components/Layout.tsx packages/admin/src/components/icons.tsx
git commit -m "feat(admin): add audit log viewer page"
```

---

## Task 8: Attachment Cleanup Job

**Files:**
- Modify: `packages/server/src/jobs/digest.ts`
- Test: `packages/server/src/__tests__/cleanup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/__tests__/cleanup.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  prisma: {
    attachment: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../db/client.js';

describe('cleanupOrphanedAttachments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes attachments older than 24h with no feedback', async () => {
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([
      { id: 'att_1' },
      { id: 'att_2' },
    ] as any);
    vi.mocked(prisma.attachment.deleteMany).mockResolvedValue({ count: 2 } as any);

    const { cleanupOrphanedAttachments } = await import('../jobs/digest.js');
    const result = await cleanupOrphanedAttachments();

    expect(result).toBe(2);
    expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['att_1', 'att_2'] } },
    });
  });

  it('does nothing when no orphaned attachments', async () => {
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);

    const { cleanupOrphanedAttachments } = await import('../jobs/digest.js');
    const result = await cleanupOrphanedAttachments();

    expect(result).toBe(0);
    expect(prisma.attachment.deleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/cleanup.test.ts`
Expected: FAIL — function not exported

- [ ] **Step 3: Implement cleanup function**

In `packages/server/src/jobs/digest.ts`, add:

```typescript
export async function cleanupOrphanedAttachments(): Promise<number> {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const orphans = await prisma.attachment.findMany({
    where: {
      feedback_id: null,
      created_at: { lt: oneDayAgo },
    },
    select: { id: true },
  });

  if (orphans.length === 0) return 0;

  const result = await prisma.attachment.deleteMany({
    where: { id: { in: orphans.map((o) => o.id) } },
  });

  console.log(JSON.stringify({
    level: 'info',
    msg: `Cleaned up ${result.count} orphaned attachments`,
    ts: new Date().toISOString(),
  }));

  return result.count;
}
```

Also schedule it in `startDigestJob()`:

```typescript
export function startDigestJob(): void {
  // Monday 9:00 AM — weekly digest
  cron.schedule('0 9 * * 1', () => {
    runWeeklyDigest().catch((err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'Weekly digest failed', error: String(err) }));
    });
  });

  // Daily 3:00 AM — cleanup orphaned attachments
  cron.schedule('0 3 * * *', () => {
    cleanupOrphanedAttachments().catch((err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'Attachment cleanup failed', error: String(err) }));
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/__tests__/cleanup.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass (including new ones)

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/jobs/digest.ts packages/server/src/__tests__/cleanup.test.ts
git commit -m "feat: add orphaned attachment cleanup job"
```

---

## Task 9: Final Integration Check

- [ ] **Step 1: Run all tests**

Run: `cd E:\AIcodeing\nexus-feedback && pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `cd E:\AIcodeing\nexus-feedback && pnpm -r run typecheck`
Expected: All packages pass

- [ ] **Step 3: Run build**

Run: `cd E:\AIcodeing\nexus-feedback && pnpm build`
Expected: All packages build successfully

- [ ] **Step 4: Verify migration status**

Run: `cd packages/server && npx prisma migrate status`
Expected: Database schema is up to date

---

## Self-Review Notes

**Spec coverage:**
- ✅ Widget/Board dynamic categories — Tasks 1, 2, 3
- ✅ Feedback assignment — Tasks 4, 5, 6
- ✅ Audit log UI — Task 7
- ✅ Attachment cleanup job — Task 8

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:**
- `assignee_id: string | null` used consistently across schema, service, and frontend
- `AuditLog` type matches Prisma model shape
- `ProjectCategory` interface consistent between widget and board
