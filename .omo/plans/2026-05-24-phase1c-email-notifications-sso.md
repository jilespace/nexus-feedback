# Phase 1C: Email Notifications + JWT SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email notifications (status change alerts to voters/submitters, new feedback alerts to admins, weekly digest) and JWT SSO for identifying end-users from host applications.

**Architecture:** Use Resend for email delivery (free tier: 100 emails/day, 3000/month). Add notification queue in DB. SSO via JWT token verification with configurable public key per project.

**Tech Stack:** Resend SDK, node-cron for digests, JWT verification, React Email templates

**Depends on:** Phase 1A (multi-tenant), Phase 1B (public board, voting)

---

## File Structure

### New Files (Server)
- `packages/server/src/services/email.ts` — Resend client + send helpers
- `packages/server/src/services/notification.ts` — notification logic + queue
- `packages/server/src/templates/status-change.ts` — email template
- `packages/server/src/templates/new-feedback.ts` — email template
- `packages/server/src/templates/weekly-digest.ts` — email template
- `packages/server/src/jobs/digest.ts` — weekly digest cron job

### New Prisma Models
```prisma
model NotificationPreference {
  id              String  @id @default(cuid())
  email           String
  project_id      String
  status_updates  Boolean @default(true)
  weekly_digest   Boolean @default(true)
  @@unique([email, project_id])
}

model SSOConfig {
  id              String  @id @default(cuid())
  project_id      String  @unique
  project         Project @relation(fields: [project_id], references: [id])
  jwt_secret      String  // shared secret or public key
  user_id_claim   String  @default("sub")
  email_claim     String  @default("email")
  name_claim      String  @default("name")
}
```

### Modified Files
- `packages/server/src/config/index.ts` — add RESEND_API_KEY env
- `packages/server/src/services/feedback.ts` — trigger notifications on status change
- `packages/server/src/services/vote.ts` — trigger notifications on milestone votes
- `packages/server/src/routes/public.ts` — SSO token verification middleware
- `packages/server/package.json` — add resend, node-cron deps

---

## Task 1: Email Service Setup

- [ ] Add `resend` and `node-cron` to server dependencies
- [ ] Add `RESEND_API_KEY` to env config (optional, graceful fallback if not set)
- [ ] Create email service with `sendEmail(to, subject, html)` wrapper
- [ ] Create status change email template (plain HTML, no external deps)
- [ ] Create new feedback notification template
- [ ] Create weekly digest template

## Task 2: Notification Logic

- [ ] Add NotificationPreference model to Prisma schema
- [ ] Create notification service:
  - `notifyStatusChange(feedbackId, newStatus)` — emails submitter + all voters
  - `notifyNewFeedback(feedbackId)` — emails org admins
  - `notifyReply(feedbackId, replyContent)` — emails submitter
- [ ] Hook notifications into feedback status update service
- [ ] Hook notifications into reply creation
- [ ] Add unsubscribe endpoint: `POST /api/v1/public/unsubscribe`

## Task 3: Weekly Digest Job

- [ ] Create digest job that runs every Monday 9:00 AM
  - Collects: new feedback count, resolved count, top voted items
  - Sends to all org members with digest preference enabled
- [ ] Register cron job in server startup (only in production)

## Task 4: JWT SSO for End Users

- [ ] Add SSOConfig model to Prisma schema
- [ ] Create SSO middleware that:
  - Checks for `X-SSO-Token` header on public routes
  - Verifies JWT against project's configured secret
  - Extracts user identity (email, name, user_id) from claims
  - Attaches to request for use in voting/commenting
- [ ] Add admin route to configure SSO per project:
  - `POST /api/v1/admin/projects/:id/sso` — set JWT secret + claim mappings
  - `GET /api/v1/admin/projects/:id/sso` — get current config
- [ ] When SSO token present, auto-identify voter (no email prompt needed)

## Task 5: Admin UI — Notification Settings

- [ ] Add notification settings section in project settings
- [ ] Toggle: email on new feedback, email on status change
- [ ] SSO configuration form (JWT secret, claim mappings)

## Verification

- [ ] `pnpm lint` — all packages clean
- [ ] `pnpm typecheck` — all packages clean
- [ ] `pnpm test` — all tests pass
- [ ] Email sends correctly when RESEND_API_KEY is configured
- [ ] Graceful no-op when RESEND_API_KEY is not set
- [ ] SSO token correctly identifies users on public routes
- [ ] Unsubscribe link works in emails

---

## Environment Variables (new)

```env
# Email (optional - notifications disabled if not set)
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=notifications@your-domain.com

# Digest schedule (optional)
DIGEST_CRON=0 9 * * 1
```
