# Phase 1B: Public Board + Roadmap + Changelog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public-facing feedback board where users can browse/vote/comment on feedback, a roadmap page showing planned/in-progress/completed items, and a changelog module for publishing product updates.

**Architecture:** New `packages/board` Vite+React app for the public-facing pages. Server-side additions for public APIs (no admin auth needed, only API key or project slug). Changelog model added to Prisma.

**Tech Stack:** React 18, Tailwind CSS, TanStack Query, Vite, Express routes

**Depends on:** Phase 1A (multi-tenant, voting)

---

## File Structure

### New Files (Server)
- `packages/server/src/routes/public.ts` — public feedback board API (no admin auth)
- `packages/server/src/services/changelog.ts` — changelog CRUD
- `packages/server/prisma/migrations/xxx_changelog/migration.sql` — auto

### New Prisma Models
```prisma
model Changelog {
  id              String   @id @default(cuid())
  title           String
  content         String
  published       Boolean  @default(false)
  published_at    DateTime?
  project_id      String
  project         Project  @relation(fields: [project_id], references: [id])
  related_feedbacks ChangelogFeedback[]
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

model ChangelogFeedback {
  changelog_id String
  feedback_id  String
  changelog    Changelog @relation(fields: [changelog_id], references: [id])
  feedback     Feedback  @relation(fields: [feedback_id], references: [id])
  @@id([changelog_id, feedback_id])
}

model Comment {
  id          String   @id @default(cuid())
  content     String
  author_email String
  author_name  String?
  feedback_id String
  feedback    Feedback @relation(fields: [feedback_id], references: [id])
  created_at  DateTime @default(now())
}
```

### New Package: `packages/board`
- `package.json` — React + Tailwind + TanStack Query
- `vite.config.ts` — proxy to server
- `src/main.tsx` — entry
- `src/App.tsx` — routing by project slug
- `src/pages/BoardHome.tsx` — feedback list with voting
- `src/pages/FeedbackView.tsx` — single feedback with comments + vote
- `src/pages/Roadmap.tsx` — kanban columns by status
- `src/pages/ChangelogList.tsx` — published updates timeline
- `src/components/VoteButton.tsx` — upvote interaction
- `src/components/CommentForm.tsx` — add comment (email required)

---

## Task 1: Changelog Prisma Model + Migration

- [ ] Add Changelog, ChangelogFeedback, Comment models to schema
- [ ] Add `comments Comment[]` and `changelogs ChangelogFeedback[]` to Feedback model
- [ ] Run migration
- [ ] Regenerate Prisma client

## Task 2: Public API Routes

New routes at `/api/v1/public/:projectSlug/`:
- [ ] `GET /feedback` — list feedback (sorted by votes/newest), includes vote_count, comment_count, tags
- [ ] `GET /feedback/:id` — feedback detail with comments
- [ ] `POST /feedback/:id/vote` — vote (body: `{ email }`)
- [ ] `DELETE /feedback/:id/vote` — unvote (body: `{ email }`)
- [ ] `POST /feedback/:id/comments` — add comment (body: `{ email, name?, content }`)
- [ ] `POST /feedback` — submit new feedback (body: same as existing)
- [ ] `GET /roadmap` — feedback grouped by status (open/in_progress/resolved)
- [ ] `GET /changelog` — published changelog entries

## Task 3: Changelog Admin Routes

Add to admin router (org-scoped):
- [ ] `GET /admin/changelog` — list all (drafts + published)
- [ ] `POST /admin/changelog` — create entry
- [ ] `PATCH /admin/changelog/:id` — update entry
- [ ] `POST /admin/changelog/:id/publish` — publish (set published=true, published_at=now)
- [ ] `DELETE /admin/changelog/:id` — delete entry

## Task 4: Public Board Frontend (`packages/board`)

- [ ] Init Vite + React + TS + Tailwind project
- [ ] Board home page — list feedback with vote buttons, sort by votes/newest
- [ ] Feedback detail page — content, vote, comments section
- [ ] Roadmap page — three columns (Planned / In Progress / Done)
- [ ] Changelog page — timeline of published updates
- [ ] Comment form — requires email, optional name
- [ ] Vote button — toggle upvote, shows count, requires email (stored in localStorage)

## Task 5: Admin UI — Changelog Management

- [ ] Add changelog page to admin (`packages/admin/src/pages/Changelog.tsx`)
- [ ] Add nav item in Layout
- [ ] Create/edit/publish/delete changelog entries
- [ ] Link feedback to changelog entries

## Verification

- [ ] `pnpm lint` — all packages clean
- [ ] `pnpm typecheck` — all packages clean
- [ ] `pnpm test` — all tests pass
- [ ] Public board accessible at `http://localhost:8082/:projectSlug`
- [ ] Voting works without registration (email in localStorage)
- [ ] Comments display correctly
- [ ] Roadmap shows correct column distribution
- [ ] Changelog shows only published entries publicly
