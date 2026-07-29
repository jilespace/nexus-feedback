import { env } from '../config/index.js';

const BASE_URL = env.BASE_URL || 'http://localhost:8080';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  return emailWrapper(content);
}

export function buildReplyEmail(title: string, replyContent: string, feedbackId: string): string {
  const content = `<h2 style="margin:0 0 16px;font-size:18px;color:#111827">新回复</h2>
<p style="margin:0 0 8px;color:#374151">您的反馈 <strong>${escapeHtml(title)}</strong> 收到了新回复：</p>
<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #4f46e5;background:#f9fafb;color:#374151;font-size:14px">${escapeHtml(replyContent)}</blockquote>
<a href="${BASE_URL}/feedback/${feedbackId}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">查看完整对话</a>`;
  return emailWrapper(content);
}

export function buildNewFeedbackEmail(title: string, category: string, feedbackId: string): string {
  const content = `<h2 style="margin:0 0 16px;font-size:18px;color:#111827">新反馈提交</h2>
<p style="margin:0 0 8px;color:#374151"><strong>${escapeHtml(title)}</strong></p>
<p style="margin:0 0 16px;color:#6b7280">分类: ${escapeHtml(category)}</p>
<a href="${BASE_URL}/feedback/${feedbackId}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">查看反馈</a>`;
  return emailWrapper(content);
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
  return emailWrapper(content);
}
