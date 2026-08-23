import { env } from '../config/index.js';

const BASE_URL = env.BASE_URL || 'http://localhost:8080';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BRAND_COLOR = '#4f46e5';
const BRAND_COLOR_LIGHT = '#eef2ff';

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:24px">
<tr><td>
<div style="background:#fff;border-radius:16px;padding:0;border:1px solid #e5e7eb;overflow:hidden">
<div style="background:${BRAND_COLOR};height:6px"></div>
<div style="padding:32px 40px">
<div style="margin-bottom:24px;text-align:center">
<div style="display:inline-flex;align-items:center;gap:8px">
<div style="width:28px;height:28px;background:${BRAND_COLOR};border-radius:8px;display:flex;align-items:center;justify-content:center">
<span style="color:#fff;font-size:13px;font-weight:700">N</span>
</div>
<span style="font-size:15px;font-weight:700;color:#111827">Nexus Feedback</span>
</div>
</div>
${content}
</div>
<div style="padding:0 40px 32px;border-top:1px solid #f3f4f6;padding-top:20px;margin-top:8px">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">Nexus Feedback — 用户反馈管理平台</p>
<p style="margin:4px 0 0;font-size:11px;color:#d1d5db;text-align:center">此邮件由系统自动发送，请勿回复</p>
</div>
</div>
</td></tr>
</table>
</body></html>`;
}

function ctaButton(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 32px;background:${BRAND_COLOR};color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 1px 2px rgba(79,70,229,0.2)">${escapeHtml(text)}</a>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    open: '#f59e0b',
    in_progress: '#3b82f6',
    resolved: '#10b981',
    closed: '#6b7280',
  };
  const color = colors[status] || '#6b7280';
  return `<span style="display:inline-block;padding:4px 12px;background:${color}15;color:${color};border-radius:20px;font-size:12px;font-weight:600">${escapeHtml(status)}</span>`;
}

export function buildInviteEmail(orgName: string, inviteUrl: string): string {
  const content = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">您被邀请加入 ${escapeHtml(orgName)}</h1>
<p style="margin:0 0 24px;color:#6b7280;font-size:14px">点击下方按钮接受邀请，设置密码即可完成注册</p>
<div style="text-align:center;margin:32px 0">
${ctaButton('接受邀请', inviteUrl)}
</div>
<p style="margin:0 0 8px;color:#9ca3af;font-size:13px;text-align:center">或复制以下链接到浏览器打开：</p>
<p style="margin:0 0 32px;color:${BRAND_COLOR};font-size:12px;word-break:break-all;text-align:center">${escapeHtml(inviteUrl)}</p>
<div style="background:${BRAND_COLOR_LIGHT};border-radius:10px;padding:16px 20px;margin-bottom:8px">
<p style="margin:0;font-size:13px;color:#374151">此邀请链接将在 <strong>72 小时</strong>后过期，请尽快完成注册</p>
</div>
<p style="margin:0;font-size:12px;color:#9ca3af">如果您没有预期收到此邀请，请忽略此邮件</p>`;
  return emailWrapper(content);
}

export function buildStatusChangeEmail(title: string, newStatus: string, feedbackId: string): string {
  const content = `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827">反馈状态已更新</h1>
<p style="margin:0 0 16px;color:#6b7280;font-size:14px">您关注的反馈状态发生了变化</p>
<div style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:16px">
<p style="margin:0 0 8px;font-size:14px;color:#374151"><strong>${escapeHtml(title)}</strong></p>
<p style="margin:0;font-size:13px;color:#6b7280">新状态：${statusBadge(newStatus)}</p>
</div>
<div style="text-align:center;margin:24px 0">
${ctaButton('查看反馈', `${BASE_URL}/feedback/${feedbackId}`)}
</div>`;
  return emailWrapper(content);
}

export function buildReplyEmail(title: string, replyContent: string, feedbackId: string): string {
  const content = `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827">收到新回复</h1>
<p style="margin:0 0 16px;color:#6b7280;font-size:14px">您的反馈 <strong>${escapeHtml(title)}</strong> 收到了新回复：</p>
<blockquote style="margin:0 0 24px;padding:16px 20px;border-left:4px solid ${BRAND_COLOR};background:${BRAND_COLOR_LIGHT};border-radius:0 10px 10px 0;color:#374151;font-size:14px;line-height:1.6">${escapeHtml(replyContent)}</blockquote>
<div style="text-align:center;margin:24px 0">
${ctaButton('查看完整对话', `${BASE_URL}/feedback/${feedbackId}`)}
</div>`;
  return emailWrapper(content);
}

export function buildNewFeedbackEmail(title: string, category: string, feedbackId: string): string {
  const content = `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827">新反馈提交</h1>
<p style="margin:0 0 16px;color:#6b7280;font-size:14px">有用户提交了新的反馈</p>
<div style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:16px">
<p style="margin:0 0 8px;font-size:14px;color:#374151"><strong>${escapeHtml(title)}</strong></p>
<p style="margin:0;font-size:13px;color:#6b7280">分类：<span style="display:inline-block;padding:2px 10px;background:${BRAND_COLOR_LIGHT};color:${BRAND_COLOR};border-radius:12px;font-size:12px">${escapeHtml(category)}</span></p>
</div>
<div style="text-align:center;margin:24px 0">
${ctaButton('查看反馈', `${BASE_URL}/feedback/${feedbackId}`)}
</div>`;
  return emailWrapper(content);
}

export function buildDigestEmail(data: {
  newCount: number;
  resolvedCount: number;
  topFeedback: { title: string; votes: number }[];
}): string {
  const topList = data.topFeedback
    .map(
      (f) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151">${escapeHtml(f.title)}</td><td style="padding:12px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;color:#9ca3af;white-space:nowrap">${f.votes} 票</td></tr>`,
    )
    .join('');
  const content = `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827">本周反馈摘要</h1>
<p style="margin:0 0 24px;color:#6b7280;font-size:14px">以下是本周的反馈动态概览</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
<tr>
<td width="50%" style="padding:0 4px">
<div style="background:${BRAND_COLOR_LIGHT};border-radius:12px;padding:24px;text-align:center">
<p style="margin:0;font-size:32px;font-weight:800;color:${BRAND_COLOR}">${data.newCount}</p>
<p style="margin:4px 0 0;font-size:13px;color:#6b7280">新反馈</p>
</div>
</td>
<td width="50%" style="padding:0 4px">
<div style="background:#ecfdf5;border-radius:12px;padding:24px;text-align:center">
<p style="margin:0;font-size:32px;font-weight:800;color:#10b981">${data.resolvedCount}</p>
<p style="margin:4px 0 0;font-size:13px;color:#6b7280">已解决</p>
</div>
</td>
</tr>
</table>
${data.topFeedback.length > 0 ? `<h2 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#374151">热门反馈</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${topList}</table>` : '<p style="margin:0;font-size:14px;color:#9ca3af">本周暂无反馈</p>'}`;
  return emailWrapper(content);
}
