import { prisma } from '../db/client.js';
import { sendEmail, sendBatchEmails } from './email.js';
import { buildStatusChangeEmail, buildNewFeedbackEmail, buildReplyEmail } from '../utils/emailTemplates.js';

export async function notifyStatusChange(feedbackId: string, newStatus: string): Promise<void> {
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: { votes: { select: { email: true } }, project: { select: { org_id: true } } },
  });
  if (!feedback) return;

  const emails = new Set<string>();
  if (feedback.contact) emails.add(feedback.contact);
  for (const vote of feedback.votes) {
    emails.add(vote.email);
  }
  if (emails.size === 0) return;

  // Check preferences
  const prefs = await prisma.notificationPreference.findMany({
    where: { email: { in: [...emails] }, project_id: feedback.project_id ?? '' },
  });
  const disabledEmails = new Set(
    prefs.filter((p) => !p.status_updates).map((p) => p.email),
  );

  const recipients = [...emails].filter((e) => !disabledEmails.has(e));
  if (recipients.length === 0) return;

  const subject = `Feedback status updated: ${feedback.title}`;
  const html = buildStatusChangeEmail(feedback.title, newStatus, feedbackId);
  await sendBatchEmails(recipients, subject, html, feedback.project.org_id);
}

export async function notifyNewFeedback(feedbackId: string, orgId: string): Promise<void> {
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) return;

  const members = await prisma.member.findMany({
    where: { org_id: orgId, role: { in: ['owner', 'admin'] } },
    select: { email: true },
  });
  if (members.length === 0) return;

  const subject = `New feedback: ${feedback.title}`;
  const html = buildNewFeedbackEmail(feedback.title, feedback.category, feedbackId);
  await sendBatchEmails(members.map((m) => m.email), subject, html, orgId);
}

export async function notifyReply(feedbackId: string, replyContent: string): Promise<void> {
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: { project: { select: { org_id: true } } },
  });
  if (!feedback || !feedback.contact) return;

  const subject = `New reply on: ${feedback.title}`;
  const html = buildReplyEmail(feedback.title, replyContent, feedbackId);
  await sendEmail(feedback.contact, subject, html, feedback.project.org_id);
}


