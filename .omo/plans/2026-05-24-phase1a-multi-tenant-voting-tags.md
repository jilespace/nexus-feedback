# Phase 1A: Multi-Tenant + Voting + Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-admin system into a multi-tenant SaaS with organization/project/member hierarchy, user voting on feedback, and a flexible tag system.

**Architecture:** Replace the current flat Application model with Organization → Project → Member hierarchy. Add Voter identity (email-based, no registration required). Add Vote and Tag models. Migrate existing data.

**Tech Stack:** Prisma (schema migration), Express routes, Zod validation, JWT (org-scoped tokens)

---

## File Structure

### New Files
- `packages/server/prisma/migrations/xxx_multi_tenant/migration.sql` — auto-generated
- `packages/server/src/services/organization.ts` — org CRUD + member management
- `packages/server/src/services/vote.ts` — voting logic
- `packages/server/src/services/tag.ts` — tag CRUD + assignment
- `packages/server/src/routes/organization.ts` — org routes
- `packages/server/src/routes/vote.ts` — public voting routes
- `packages/server/src/middleware/orgAuth.ts` — org-scoped auth middleware

### Modified Files
- `packages/server/prisma/schema.prisma` — new models
- `packages/server/src/routes/admin.ts` — scope to org/project
- `packages/server/src/services/admin.ts` — multi-admin support
- `packages/server/src/services/feedback.ts` — add vote counts, tags
- `packages/server/src/app.ts` — register new routes

---

## Task 1: Prisma Schema — Multi-Tenant Models

**Files:**
- Modify: `packages/server/prisma/schema.prisma`

- [ ] **Step 1: Update schema with new models**

Add these models to the existing schema:

```prisma
model Organization {
  id         String   @id @default(cuid())
  name       String
  slug       String   @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
  members    Member[]
  projects   Project[]
}

model Member {
  id              String       @id @default(cuid())
  email           String
  password_hash   String
  display_name    String
  role            String       @default("member") // owner, admin, member
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  created_at      DateTime     @default(now())
  @@unique([email, organization_id])
}

model Project {
  id              String       @id @default(cuid())
  name            String
  slug            String
  description     String?
  api_key_hash    String       @unique
  allowed_origins String[]
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  feedbacks       Feedback[]
  created_at      DateTime     @default(now())
  @@unique([slug, organization_id])
}

model Vote {
  id          String   @id @default(cuid())
  feedback_id String
  feedback    Feedback @relation(fields: [feedback_id], references: [id])
  voter_email String
  created_at  DateTime @default(now())
  @@unique([feedback_id, voter_email])
}

model Tag {
  id              String       @id @default(cuid())
  name            String
  color           String       @default("#6B7280")
  organization_id String
  feedbacks       FeedbackTag[]
  @@unique([name, organization_id])
}

model FeedbackTag {
  feedback_id String
  tag_id      String
  feedback    Feedback @relation(fields: [feedback_id], references: [id])
  tag         Tag      @relation(fields: [tag_id], references: [id])
  @@id([feedback_id, tag_id])
}
```

Update the existing `Feedback` model to add:
```prisma
  votes        Vote[]
  tags         FeedbackTag[]
  vote_count   Int          @default(0)
  project_id   String?
  project      Project?     @relation(fields: [project_id], references: [id])
```

Remove the old `Admin` model (replaced by `Member`).
Update `Application` → rename to `Project` or keep as legacy with a `project_id` link.

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name multi_tenant
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Verify typecheck passes**

```bash
pnpm --filter @nexus-feedback/server typecheck
```

---

## Task 2: Organization Service

**Files:**
- Create: `packages/server/src/services/organization.ts`

- [ ] **Step 1: Create organization service**

```typescript
import crypto from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { env } from '../config/index.js';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';

export async function createOrganization(input: {
  orgName: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerDisplayName: string;
}) {
  const existing = await prisma.organization.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ConflictError('Organization slug already taken');

  const passwordHash = await argon2.hash(input.ownerPassword);

  const org = await prisma.organization.create({
    data: {
      name: input.orgName,
      slug: input.slug,
      members: {
        create: {
          email: input.ownerEmail,
          password_hash: passwordHash,
          display_name: input.ownerDisplayName,
          role: 'owner',
        },
      },
    },
    include: { members: true },
  });

  return { id: org.id, name: org.name, slug: org.slug };
}

export async function memberLogin(email: string, password: string, orgSlug: string) {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new NotFoundError('Organization not found');

  const member = await prisma.member.findUnique({
    where: { email_organization_id: { email, organization_id: org.id } },
  });
  if (!member) throw new ValidationError('Invalid credentials');

  const valid = await argon2.verify(member.password_hash, password);
  if (!valid) throw new ValidationError('Invalid credentials');

  const token = jwt.sign(
    { sub: member.id, org_id: org.id, role: member.role },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );

  return { token, member: { id: member.id, email: member.email, role: member.role, display_name: member.display_name }, organization: { id: org.id, name: org.name, slug: org.slug } };
}

export async function inviteMember(orgId: string, input: {
  email: string;
  password: string;
  displayName: string;
  role: 'admin' | 'member';
}) {
  const existing = await prisma.member.findUnique({
    where: { email_organization_id: { email: input.email, organization_id: orgId } },
  });
  if (existing) throw new ConflictError('Member already exists');

  const passwordHash = await argon2.hash(input.password);
  const member = await prisma.member.create({
    data: {
      email: input.email,
      password_hash: passwordHash,
      display_name: input.displayName,
      role: input.role,
      organization_id: orgId,
    },
  });

  return { id: member.id, email: member.email, role: member.role };
}

export async function listMembers(orgId: string) {
  return prisma.member.findMany({
    where: { organization_id: orgId },
    select: { id: true, email: true, display_name: true, role: true, created_at: true },
  });
}

export async function removeMember(orgId: string, memberId: string) {
  const member = await prisma.member.findFirst({ where: { id: memberId, organization_id: orgId } });
  if (!member) throw new NotFoundError('Member not found');
  if (member.role === 'owner') throw new ValidationError('Cannot remove organization owner');
  await prisma.member.delete({ where: { id: memberId } });
}
```

- [ ] **Step 2: Verify lint and typecheck**

```bash
pnpm --filter @nexus-feedback/server lint && pnpm --filter @nexus-feedback/server typecheck
```

---

## Task 3: Vote Service

**Files:**
- Create: `packages/server/src/services/vote.ts`

- [ ] **Step 1: Create vote service**

```typescript
import { prisma } from '../db/client.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

export async function addVote(feedbackId: string, voterEmail: string) {
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) throw new NotFoundError('Feedback not found');

  const existing = await prisma.vote.findUnique({
    where: { feedback_id_voter_email: { feedback_id: feedbackId, voter_email: voterEmail } },
  });
  if (existing) throw new ConflictError('Already voted');

  await prisma.$transaction([
    prisma.vote.create({ data: { feedback_id: feedbackId, voter_email: voterEmail } }),
    prisma.feedback.update({ where: { id: feedbackId }, data: { vote_count: { increment: 1 } } }),
  ]);

  return { feedback_id: feedbackId, vote_count: feedback.vote_count + 1 };
}

export async function removeVote(feedbackId: string, voterEmail: string) {
  const vote = await prisma.vote.findUnique({
    where: { feedback_id_voter_email: { feedback_id: feedbackId, voter_email: voterEmail } },
  });
  if (!vote) throw new NotFoundError('Vote not found');

  await prisma.$transaction([
    prisma.vote.delete({ where: { id: vote.id } }),
    prisma.feedback.update({ where: { id: feedbackId }, data: { vote_count: { decrement: 1 } } }),
  ]);

  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  return { feedback_id: feedbackId, vote_count: feedback?.vote_count ?? 0 };
}

export async function hasVoted(feedbackId: string, voterEmail: string): Promise<boolean> {
  const vote = await prisma.vote.findUnique({
    where: { feedback_id_voter_email: { feedback_id: feedbackId, voter_email: voterEmail } },
  });
  return !!vote;
}

export async function getVoters(feedbackId: string) {
  return prisma.vote.findMany({
    where: { feedback_id: feedbackId },
    select: { voter_email: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
}
```

---

## Task 4: Tag Service

**Files:**
- Create: `packages/server/src/services/tag.ts`

- [ ] **Step 1: Create tag service**

```typescript
import { prisma } from '../db/client.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';

export async function createTag(orgId: string, name: string, color?: string) {
  const existing = await prisma.tag.findUnique({
    where: { name_organization_id: { name, organization_id: orgId } },
  });
  if (existing) throw new ConflictError('Tag already exists');

  return prisma.tag.create({
    data: { name, color: color ?? '#6B7280', organization_id: orgId },
  });
}

export async function listTags(orgId: string) {
  return prisma.tag.findMany({
    where: { organization_id: orgId },
    orderBy: { name: 'asc' },
  });
}

export async function deleteTag(orgId: string, tagId: string) {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, organization_id: orgId } });
  if (!tag) throw new NotFoundError('Tag not found');
  await prisma.feedbackTag.deleteMany({ where: { tag_id: tagId } });
  await prisma.tag.delete({ where: { id: tagId } });
}

export async function assignTags(feedbackId: string, tagIds: string[]) {
  await prisma.feedbackTag.deleteMany({ where: { feedback_id: feedbackId } });
  if (tagIds.length > 0) {
    await prisma.feedbackTag.createMany({
      data: tagIds.map((tag_id) => ({ feedback_id: feedbackId, tag_id })),
    });
  }
}
```

---

## Task 5: Organization Routes + Auth Middleware

**Files:**
- Create: `packages/server/src/middleware/orgAuth.ts`
- Create: `packages/server/src/routes/organization.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create org-scoped auth middleware**

```typescript
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { AuthError } from '../utils/errors.js';

export type OrgTokenPayload = {
  sub: string;      // member ID
  org_id: string;   // organization ID
  role: string;     // owner | admin | member
};

export function orgAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AuthError(40110, 'Token missing'));
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as OrgTokenPayload;
    req.memberId = payload.sub;
    req.orgId = payload.org_id;
    req.memberRole = payload.role;
    next();
  } catch {
    next(new AuthError(40110, 'Token invalid or expired'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(req.memberRole ?? '')) {
      return next(new AuthError(40300, 'Insufficient permissions'));
    }
    next();
  };
}
```

- [ ] **Step 2: Update express.d.ts for new request fields**

Add to `packages/server/src/types/express.d.ts`:
```typescript
declare namespace Express {
  interface Request {
    applicationId?: string;
    adminId?: string;
    memberId?: string;
    orgId?: string;
    memberRole?: string;
  }
}
```

- [ ] **Step 3: Create organization routes**

- [ ] **Step 4: Create vote routes (public, API-key scoped)**

- [ ] **Step 5: Create tag routes (admin, org-scoped)**

- [ ] **Step 6: Register all new routes in app.ts**

- [ ] **Step 7: Run full verification**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

---

## Task 6: Update Feedback Service for Votes + Tags

**Files:**
- Modify: `packages/server/src/services/feedback.ts`

- [ ] **Step 1: Update listFeedback to include vote_count and tags**

Add `sort_by` parameter supporting `newest`, `oldest`, `most_voted`.
Include tags in response items.

- [ ] **Step 2: Update getFeedbackDetail to include votes and tags**

- [ ] **Step 3: Update getStats to include top voted feedback**

- [ ] **Step 4: Verify all tests still pass**

---

## Task 7: Seed Script Update

**Files:**
- Modify: `packages/server/prisma/seed.ts`

- [ ] **Step 1: Update seed to create org + member + project**

Create a default organization "Demo Org" with owner "admin@nexus.dev" / "admin123", and a project "Demo Project" with the test API key.

---

## Verification Checklist

- [ ] `pnpm lint` — all packages clean
- [ ] `pnpm typecheck` — all packages clean
- [ ] `pnpm test` — all tests pass
- [ ] New API endpoints respond correctly:
  - `POST /api/v1/org/register` — create org + owner
  - `POST /api/v1/org/login` — member login
  - `GET /api/v1/org/members` — list members
  - `POST /api/v1/org/members` — invite member
  - `POST /api/v1/feedback/:id/vote` — add vote (public, API key)
  - `DELETE /api/v1/feedback/:id/vote` — remove vote
  - `GET /api/v1/admin/tags` — list tags
  - `POST /api/v1/admin/tags` — create tag
  - `PUT /api/v1/admin/feedback/:id/tags` — assign tags
