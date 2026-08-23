import cron from 'node-cron';
import { prisma } from '../db/client.js';
import { sendBatchEmails } from '../services/email.js';

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

async function runWeeklyDigest(): Promise<void> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const projects = await prisma.project.findMany({ select: { id: true, name: true, org_id: true } });

  for (const project of projects) {
    const [newCount, resolvedCount, topVoted] = await Promise.all([
      prisma.feedback.count({
        where: { project_id: project.id, created_at: { gte: oneWeekAgo } },
      }),
      prisma.feedback.count({
        where: { project_id: project.id, status: 'resolved', updated_at: { gte: oneWeekAgo } },
      }),
      prisma.feedback.findMany({
        where: { project_id: project.id, created_at: { gte: oneWeekAgo } },
        orderBy: { vote_count: 'desc' },
        take: 5,
        select: { id: true, title: true, vote_count: true },
      }),
    ]);

    if (newCount === 0 && resolvedCount === 0) continue;

    const members = await prisma.member.findMany({
      where: { org_id: project.org_id },
      select: { email: true },
    });

    // Filter by digest preference
    const prefs = await prisma.notificationPreference.findMany({
      where: { project_id: project.id, weekly_digest: false },
      select: { email: true },
    });
    const disabledEmails = new Set(prefs.map((p) => p.email));
    const recipients = members.map((m) => m.email).filter((e) => !disabledEmails.has(e));
    if (recipients.length === 0) continue;

    const subject = `Weekly Digest: ${project.name}`;
    const html = buildDigestEmail(project.name, newCount, resolvedCount, topVoted);
    await sendBatchEmails(recipients, subject, html, project.org_id);
  }
}

function buildDigestEmail(
  projectName: string,
  newCount: number,
  resolvedCount: number,
  topVoted: { id: string; title: string; vote_count: number }[],
): string {
  const topItems = topVoted
    .map((item) => `<li>${item.title} (${item.vote_count} votes)</li>`)
    .join('');

  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
<h2>Weekly Digest: ${projectName}</h2>
<p><strong>${newCount}</strong> new feedback items this week</p>
<p><strong>${resolvedCount}</strong> items resolved</p>
${topItems ? `<h3>Top Voted</h3><ul>${topItems}</ul>` : ''}
<hr/>
<p style="font-size:12px;color:#666"><a href="https://app.nexus-feedback.dev/unsubscribe">Unsubscribe</a></p>
</div>`;
}
