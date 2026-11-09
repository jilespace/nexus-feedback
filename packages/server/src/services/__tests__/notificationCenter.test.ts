import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  prisma: {
    member: { findMany: vi.fn() },
    notification: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const {
  notifyFeedbackCreated,
  notifyFeedbackAssigned,
  notifyFeedbackStatusChanged,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = await import('../notificationCenter.js');
const { prisma } = await import('../../db/client.js');

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.member.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 'owner-1' },
    { id: 'admin-1' },
  ]);
  (prisma.notification.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
});

describe('notification center service', () => {
  it('notifies all staff when feedback is created, excluding the actor', async () => {
    await notifyFeedbackCreated({
      orgId: 'org-1',
      feedbackId: 'fb-1',
      title: 'Login is slow',
      category: 'performance',
      priority: 'high',
      source: 'api',
      actorId: 'admin-1',
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          org_id: 'org-1',
          member_id: 'owner-1',
          type: 'feedback.created',
          feedback_id: 'fb-1',
        }),
      ],
    });
  });

  it('notifies the assignee for assignment events', async () => {
    await notifyFeedbackAssigned({
      orgId: 'org-1',
      feedbackId: 'fb-1',
      title: 'Login is slow',
      assigneeId: 'admin-1',
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          member_id: 'admin-1',
          type: 'feedback.assigned',
        }),
      ],
    });
  });

  it('skips notification when the only recipient is the actor', async () => {
    await notifyFeedbackStatusChanged({
      orgId: 'org-1',
      feedbackId: 'fb-1',
      title: 'Login is slow',
      oldStatus: 'open',
      newStatus: 'in_progress',
      assigneeId: 'admin-1',
      actorId: 'admin-1',
    });

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('lists notifications with unread count and supports unread only filter', async () => {
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'n-1', read_at: null },
    ]);
    (prisma.notification.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);

    const result = await listNotifications('admin-1', 'org-1', {
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
      unreadOnly: true,
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.unread_count).toBe(3);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { member_id: 'admin-1', org_id: 'org-1', read_at: null },
      }),
    );
  });

  it('marks a single notification as read only for the owner', async () => {
    (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await markNotificationRead('admin-1', 'org-1', 'n-1');

    expect(result).toEqual({ updated: true });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n-1', member_id: 'admin-1', org_id: 'org-1', read_at: null },
      data: { read_at: expect.any(Date) },
    });
  });

  it('marks all notifications as read', async () => {
    (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 4 });

    const result = await markAllNotificationsRead('admin-1', 'org-1');

    expect(result).toEqual({ updated: 4 });
  });
});
