# Admin & Board Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 bugs (hardcoded categories, missing assignee filter, missing board search) and add 3 high-value features (time-to-first-response metric, CSV export improvements, webhook event expansion).

**Architecture:**
- FilterBar fetches categories from API (already have `GET /api/v1/public/:slug/categories`)
- Assignee filter reuses existing `assignee_id` field and API support
- Board search reuses existing `keyword` param in public feedback API
- Time-to-first-response computed in `getStats()` using reply timestamps
- CSV export extends existing `exportFeedbackCSV()` with tags + assignee
- Webhook events: add `fireWebhooks()` calls in relevant service functions

**Tech Stack:** Express, Prisma, React, TanStack Query, Recharts

---

## File Structure

```
packages/server/
├── src/
│   ├── routes/
│   │   └── admin.ts                  # Add assignee_id filter support
│   ├── services/
│   │   ├── feedback.ts               # Add assignee_id to listFeedback; add response_time to getStats
│   │   ├── export.ts                 # Add tags + assignee to CSV
│   │   └── webhook.ts                # Fire events for assign/merge/comment
│   └── __tests__/
│       ├── feedback-filter.test.ts   # New: assignee filter test
│       └── stats-response-time.test.ts # New: response time metric test

packages/admin/
├── src/
│   ├── components/
│   │   └── FilterBar.tsx             # Fetch categories dynamically
│   ├── pages/
│   │   ├── FeedbackList.tsx          # Add "assigned to me" toggle + assignee filter
│   │   ├── Dashboard.tsx             # Add response time card
│   │   └── Webhooks.tsx              # Add new event types
│   └── api/
│       └── client.ts                 # Add fetchProjectCategories helper

packages/board/
├── src/
│   └── pages/
│       └── BoardHome.tsx             # Add search input + dynamic categories
```

---

## Task 1: Fix FilterBar Hardcoded Categories

**Files:**
- Modify: `packages/admin/src/components/FilterBar.tsx`
- Modify: `packages/admin/src/api/client.ts`

- [ ] **Step 1: Add fetchProjectCategories to admin API client**

In `packages/admin/src/api/client.ts`, add:

```typescript
export async function fetchProjectCategories(): Promise<Array<{ name: string; color: string }>> {
  const result = await apiRequest<Array<{ name: string; color: string }>>('/org/categories');
  return result;
}
```

- [ ] **Step 2: Rewrite FilterBar to fetch categories dynamically**

Replace `packages/admin/src/components/FilterBar.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { fetchProjectCategories } from '@/api/client';

type FilterBarProps = {
  filters: Record<string, string>;
  onChange: (filters: Record<string, string>) => void;
};

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: '全部优先级' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [categories, setCategories] = useState<Array<{ name: string; color: string }>>([]);

  useEffect(() => {
    fetchProjectCategories().then(setCategories);
  }, []);

  const update = (key: string, value: string) => {
    const next = { ...filters };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    onChange(next);
  };

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        options={STATUS_OPTIONS}
        value={filters.status ?? ''}
        onChange={(v) => update('status', v)}
        active={!!filters.status}
      />
      <Select
        options={[
          { value: '', label: '全部分类' },
          ...categories.map((c) => ({ value: c.name, label: c.name })),
        ]}
        value={filters.category ?? ''}
        onChange={(v) => update('category', v)}
        active={!!filters.category}
      />
      <Select
        options={PRIORITY_OPTIONS}
        value={filters.priority ?? ''}
        onChange={(v) => update('priority', v)}
        active={!!filters.priority}
      />
      {hasFilters && (
        <button
          onClick={() => onChange({})}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <span className="text-xs">✕</span>
          重置筛选
        </button>
      )}
    </div>
  );
}

function Select({
  options,
  value,
  onChange,
  active,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  active: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'appearance-none rounded-lg border bg-surface-0 py-1.5 pl-3 pr-8 text-sm font-medium transition-all',
        'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%236b7280%27%3E%3Cpath%20fill-rule%3D%27evenodd%27%20d%3D%27M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%27%20clip-rule%3D%27evenodd%27/%3E%3C/svg%3E")] bg-[length:1.25rem] bg-[right_0.375rem_center] bg-no-repeat',
        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
        active
          ? 'border-brand-300 bg-brand-50 text-brand-700'
          : 'border-surface-3 text-gray-700',
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Add categories endpoint to admin API**

In `packages/server/src/routes/admin.ts`, add:

```typescript
import { getProjectCategoryObjects } from '../services/categoryConfig.js';

adminRouter.get('/categories', adminAuth, async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.orgId },
      include: { projects: { select: { id: true } } },
    });
    if (!org?.projects.length) {
      success(res, []);
      return;
    }
    const categories = await getProjectCategoryObjects(org.projects[0].id);
    success(res, categories);
  } catch (err) {
    next(err);
  }
});
```

Add the import at the top:
```typescript
import { prisma } from '../db/client.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd packages/admin && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/admin/src/components/FilterBar.tsx packages/admin/src/api/client.ts packages/server/src/routes/admin.ts
git commit -m "fix: fetch categories dynamically in FilterBar"
```

---

## Task 2: "Assigned to Me" Filter + Assignee Filter

**Files:**
- Modify: `packages/server/src/services/feedback.ts`
- Modify: `packages/server/src/routes/admin.ts`
- Modify: `packages/admin/src/pages/FeedbackList.tsx`
- Test: `packages/server/src/__tests__/feedback-filter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/__tests__/feedback-filter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  prisma: {
    feedback: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '../db/client.js';
import { listFeedback } from '../services/feedback.js';

describe('listFeedback with assignee_id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by assignee_id when provided', async () => {
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedback.count).mockResolvedValue(0);

    await listFeedback({ assignee_id: 'mem_1' });

    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignee_id: 'mem_1' }),
      }),
    );
  });

  it('does not filter by assignee_id when not provided', async () => {
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedback.count).mockResolvedValue(0);

    await listFeedback({});

    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ assignee_id: expect.anything() }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/feedback-filter.test.ts`
Expected: FAIL — `assignee_id` not in where clause

- [ ] **Step 3: Add assignee_id support to listFeedback**

In `packages/server/src/services/feedback.ts`, update `ListFeedbackParams`:

```typescript
export type ListFeedbackParams = {
  status?: string;
  category?: string;
  priority?: string;
  keyword?: string;
  sort_by?: 'newest' | 'oldest' | 'most_voted';
  page?: number;
  page_size?: number;
  assignee_id?: string;
};
```

In the `listFeedback` function, add after the existing where clauses:

```typescript
if (params.assignee_id) where.assignee_id = params.assignee_id;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/__tests__/feedback-filter.test.ts`
Expected: PASS

- [ ] **Step 5: Add assignee filter UI to FeedbackList**

In `packages/admin/src/pages/FeedbackList.tsx`:

1. Add import for `useAuth`:
```typescript
import { useAuth } from '@/hooks/useAuth';
```

2. Add state for assignee filter:
```typescript
const { member: currentMember } = useAuth();
const [assigneeFilter, setAssigneeFilter] = useState<string>('');
```

3. Add `assignee_id` to query params:
```typescript
const queryParams = new URLSearchParams({
  page: String(page),
  page_size: '20',
  ...filters,
  ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
  sort_by: sortBy,
  ...(assigneeFilter ? { assignee_id: assigneeFilter } : {}),
});
```

4. Add UI controls after the sort dropdown:
```tsx
<select
  value={assigneeFilter}
  onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }}
  className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
>
  <option value="">全部成员</option>
  <option value={currentMember?.id ?? ''}>分配给我</option>
</select>
```

- [ ] **Step 6: Typecheck**

Run: `cd packages/admin && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/services/feedback.ts packages/admin/src/pages/FeedbackList.tsx packages/server/src/__tests__/feedback-filter.test.ts
git commit -m "feat: add assignee filter to feedback list"
```

---

## Task 3: Public Board Search

**Files:**
- Modify: `packages/board/src/pages/BoardHome.tsx`
- Modify: `packages/board/src/api.ts`

- [ ] **Step 1: Add keyword param to board API**

In `packages/board/src/api.ts`, update `FeedbackListParams`:

```typescript
export interface FeedbackListParams {
  sort_by?: 'votes' | 'created_at';
  status?: string;
  category?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}
```

The `fetchFeedbackList` function already passes `params.keyword` to the query string via URLSearchParams. No change needed there.

- [ ] **Step 2: Add search input to BoardHome**

In `packages/board/src/pages/BoardHome.tsx`:

1. Add state:
```typescript
const [keyword, setKeyword] = useState('');
const [debouncedKeyword, setDebouncedKeyword] = useState('');
```

2. Add debounce effect:
```typescript
useEffect(() => {
  const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
  return () => clearTimeout(timer);
}, [keyword]);
```

3. Update `loadData` to include keyword:
```typescript
function loadData() {
  setLoading(true);
  setError('');
  fetchFeedbackList({
    sort_by: sortBy,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    keyword: debouncedKeyword || undefined,
  })
    .then((res) => setItems(res.items))
    .catch(() => setError('加载失败'))
    .finally(() => setLoading(false));
}
```

4. Add search input after the category filter:
```tsx
<div className="mb-4 flex gap-3">
  {/* existing selects */}
  <input
    value={keyword}
    onChange={(e) => setKeyword(e.target.value)}
    placeholder="搜索反馈..."
    className="flex-1 rounded-lg border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
  />
</div>
```

- [ ] **Step 3: Build board**

Run: `cd packages/board && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/board/src/pages/BoardHome.tsx packages/board/src/api.ts
git commit -m "feat(board): add search input"
```

---

## Task 4: Time-to-First-Response Metric

**Files:**
- Modify: `packages/server/src/services/feedback.ts`
- Modify: `packages/admin/src/pages/Dashboard.tsx`
- Test: `packages/server/src/__tests__/stats-response-time.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/__tests__/stats-response-time.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  prisma: {
    feedback: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    reply: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../db/client.js';
import { getStats } from '../services/feedback.js';

describe('getStats response_time', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes avg_response_hours in stats', async () => {
    vi.mocked(prisma.feedback.count).mockResolvedValue(10);
    vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedback.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.reply.findMany).mockResolvedValue([
      { feedback_id: 'fb_1', created_at: new Date('2024-01-02T00:00:00Z') },
    ] as any);

    const stats = await getStats('proj_1');

    expect(stats).toHaveProperty('avg_response_hours');
    expect(typeof stats.avg_response_hours).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/stats-response-time.test.ts`
Expected: FAIL — `avg_response_hours` not in return type

- [ ] **Step 3: Add response time to getStats**

In `packages/server/src/services/feedback.ts`, add to the return value of `getStats()`:

```typescript
// After existing stats computation, add:
const replies = await prisma.reply.findMany({
  where: { feedback: { project_id: projectId } },
  select: { feedback_id: true, created_at: true },
  orderBy: { created_at: 'asc' },
});

// Group first reply per feedback
const firstReplyMap = new Map<string, Date>();
for (const r of replies) {
  if (!firstReplyMap.has(r.feedback_id)) {
    firstReplyMap.set(r.feedback_id, r.created_at);
  }
}

// Get feedback creation times
const feedbackTimes = await prisma.feedback.findMany({
  where: { project_id: projectId },
  select: { id: true, created_at: true },
});

let totalHours = 0;
let count = 0;
for (const f of feedbackTimes) {
  const firstReply = firstReplyMap.get(f.id);
  if (firstReply) {
    const diffHours = (firstReply.getTime() - f.created_at.getTime()) / (1000 * 60 * 60);
    totalHours += diffHours;
    count++;
  }
}

const avgResponseHours = count > 0 ? Math.round(totalHours * 100) / 100 : 0;
```

Add to the return object:
```typescript
return {
  // ... existing fields ...
  avg_response_hours: avgResponseHours,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/__tests__/stats-response-time.test.ts`
Expected: PASS

- [ ] **Step 5: Add response time card to Dashboard**

In `packages/admin/src/pages/Dashboard.tsx`:

1. Add to STAT_CARDS:
```typescript
{ key: 'avg_response_hours', label: '平均响应时间(h)', icon: <ResponseTimeIcon />, accent: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
```

2. Add a simple icon component:
```typescript
function ResponseTimeIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className={clsx('opacity-40', className)}>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 6v4l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
```

3. Update the Stats type to include the new field:
```typescript
type DashboardStats = Stats & { avg_response_hours?: number };
```

- [ ] **Step 6: Update Stats type**

In `packages/admin/src/types/index.ts`, add to `Stats`:
```typescript
export type Stats = {
  // ... existing fields ...
  avg_response_hours?: number;
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/services/feedback.ts packages/admin/src/pages/Dashboard.tsx packages/admin/src/types/index.ts packages/server/src/__tests__/stats-response-time.test.ts
git commit -m "feat: add time-to-first-response metric"
```

---

## Task 5: CSV Export Improvements

**Files:**
- Modify: `packages/server/src/services/export.ts`

- [ ] **Step 1: Update export to include tags and assignee**

In `packages/server/src/services/export.ts`, update the query and mapping:

```typescript
const feedbacks = await prisma.feedback.findMany({
  where,
  orderBy: { created_at: 'desc' },
  include: {
    feedbackTags: { include: { tag: true } },
    assignee: { select: { display_name: true } },
  },
});

const records = feedbacks.map((f) => ({
  ID: f.id,
  标题: f.title,
  内容: f.content,
  分类: f.category,
  优先级: f.priority,
  状态: f.status,
  投票数: f.vote_count,
  来源: f.source,
  联系方式: f.contact ?? '',
  标签: f.feedbackTags.map((ft) => ft.tag.name).join(', '),
  指派给: f.assignee?.display_name ?? '',
  创建时间: f.created_at.toISOString(),
}));
```

- [ ] **Step 2: Build server**

Run: `cd packages/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/services/export.ts
git commit -m "feat: add tags and assignee to CSV export"
```

---

## Task 6: Webhook Event Expansion

**Files:**
- Modify: `packages/admin/src/pages/Webhooks.tsx`
- Modify: `packages/server/src/services/feedback.ts`
- Modify: `packages/server/src/services/comment.ts`

- [ ] **Step 1: Add new event types to Webhooks UI**

In `packages/admin/src/pages/Webhooks.tsx`, update `AVAILABLE_EVENTS`:

```typescript
const AVAILABLE_EVENTS = [
  { value: 'feedback.created', label: '反馈创建' },
  { value: 'feedback.status_changed', label: '状态变更' },
  { value: 'feedback.assigned', label: '反馈指派' },
  { value: 'feedback.merged', label: '反馈合并' },
  { value: 'comment.created', label: '新评论' },
];
```

- [ ] **Step 2: Fire webhook on feedback assignment**

In `packages/server/src/services/feedback.ts`, in the `assignFeedback` function, add after the update:

```typescript
import { fireWebhooks } from './webhook.js';

// After successful update:
fireWebhooks(feedback.project_id, 'feedback.assigned', { feedback_id: feedbackId, assignee_id: assigneeId }).catch(() => {});
```

- [ ] **Step 3: Fire webhook on feedback merge**

In `packages/server/src/services/merge.ts`, add webhook firing after successful merge:

```typescript
import { fireWebhooks } from './webhook.js';

// After successful merge:
fireWebhooks(projectId, 'feedback.merged', { source_id: feedbackId, target_id: targetId }).catch(() => {});
```

- [ ] **Step 4: Fire webhook on comment creation**

In `packages/server/src/services/comment.ts`, add webhook firing after successful comment creation:

```typescript
import { fireWebhooks } from './webhook.js';

// After successful comment creation:
fireWebhooks(projectId, 'comment.created', { feedback_id: feedbackId, comment_id: comment.id }).catch(() => {});
```

- [ ] **Step 5: Typecheck**

Run: `cd packages/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/admin/src/pages/Webhooks.tsx packages/server/src/services/feedback.ts packages/server/src/services/merge.ts packages/server/src/services/comment.ts
git commit -m "feat: expand webhook event types"
```

---

## Task 7: Final Integration Check

- [ ] **Step 1: Run all tests**

Run: `cd E:\AIcodeing\nexus-feedback && pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `cd E:\AIcodeing\nexus-feedback && pnpm -r run typecheck`
Expected: All packages pass

- [ ] **Step 3: Run build**

Run: `cd E:\AIcodeing\nexus-feedback && pnpm build`
Expected: All packages build successfully

---

## Self-Review Notes

**Spec coverage:**
- ✅ Fix FilterBar hardcoded categories — Task 1
- ✅ "Assigned to me" filter + assignee filter — Task 2
- ✅ Public board search — Task 3
- ✅ Time-to-first-response metric — Task 4
- ✅ CSV export improvements — Task 5
- ✅ Webhook event expansion — Task 6

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:**
- `assignee_id?: string` consistent across ListFeedbackParams, FeedbackDetail type, and API
- `avg_response_hours?: number` consistent across Stats type and Dashboard
- `fireWebhooks()` calls use consistent event name patterns
