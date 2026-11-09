import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  prisma: {
    member: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    notification: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
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
  deleteNotification,
  clearNotifications,
  getNotificationSettings,
  updateNotificationSettings,
  isWithinDnd,
  DEFAULT_DND,
} = await import('../notificationCenter.js');
const { prisma } = await import('../../db/client.js');

beforeEach(() => {
  vi.clearAllMocks();
  const members = [
    { id: 'owner-1', notification_settings: null },
    { id: 'admin-1', notification_settings: null },
  ];
  (prisma.member.findMany as ReturnType<typeof vi.fn>).mockImplementation(
    async (args?: { where?: { id?: { in?: string[] } } }) => {
      const ids = args?.where?.id?.in;
      return ids ? members.filter((member) => ids.includes(member.id)) : members;
    },
  );
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

  it('deletes only notifications owned by the member', async () => {
    (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await deleteNotification('admin-1', 'org-1', 'n-9');

    expect(result).toEqual({ deleted: true });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: 'n-9', member_id: 'admin-1', org_id: 'org-1' },
    });
  });

  it('clears all notifications for the member', async () => {
    (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 });

    const result = await clearNotifications('admin-1', 'org-1');

    expect(result).toEqual({ deleted: 5 });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { member_id: 'admin-1', org_id: 'org-1' },
    });
  });

  it('marks all notifications as read', async () => {
    (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 4 });

    const result = await markAllNotificationsRead('admin-1', 'org-1');

    expect(result).toEqual({ updated: 4 });
  });

  describe('notification settings', () => {
    it('defaults every type to enabled when nothing is stored', async () => {
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        notification_settings: null,
      });

      const settings = await getNotificationSettings('admin-1', 'org-1');

      expect(settings).toEqual({
        'feedback.created': true,
        'feedback.assigned': true,
        'feedback.status_changed': true,
        'feedback.comment': true,
        dnd: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
      });
    });

    it('returns stored values and fills defaults for missing keys', async () => {
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        notification_settings: { 'feedback.created': false },
      });

      const settings = await getNotificationSettings('admin-1', 'org-1');

      expect(settings['feedback.created']).toBe(false);
      expect(settings['feedback.assigned']).toBe(true);
    });

    it('merges a partial update and persists it', async () => {
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        notification_settings: { 'feedback.comment': false },
      });
      (prisma.member.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const settings = await updateNotificationSettings('admin-1', 'org-1', {
        'feedback.created': false,
      });

      expect(settings['feedback.created']).toBe(false);
      expect(settings['feedback.comment']).toBe(false);
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: { notification_settings: settings },
      });
    });

    it('rejects unknown notification types', async () => {
      await expect(
        updateNotificationSettings('admin-1', 'org-1', { 'feedback.hacked': true }),
      ).rejects.toThrow('未知的通知类型');
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it('skips recipients who muted that notification type', async () => {
      (prisma.member.findMany as ReturnType<typeof vi.fn>).mockImplementation(
        async (args?: { where?: { id?: { in?: string[] } } }) => {
          if (args?.where?.id?.in) {
            return [
              { id: 'owner-1', notification_settings: { 'feedback.created': false } },
            ];
          }
          return [{ id: 'owner-1' }, { id: 'admin-1' }];
        },
      );

      await notifyFeedbackCreated({
        orgId: 'org-1',
        feedbackId: 'fb-1',
        title: 'Login is slow',
        category: 'performance',
        priority: 'high',
        source: 'api',
        actorId: 'admin-1',
      });

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('do not disturb window', () => {
    const crossMidnight = { enabled: true, start: '23:00', end: '07:00' };
    const sameDay = { enabled: true, start: '09:00', end: '18:00' };

    function mockMembersWithDnd(dndEnabled: boolean) {
      (prisma.member.findMany as ReturnType<typeof vi.fn>).mockImplementation(
        async (args?: { where?: { id?: { in?: string[] } } }) => {
          if (args?.where?.id?.in) {
            return [
              {
                id: 'owner-1',
                notification_settings: {
                  dnd: { enabled: dndEnabled, start: '23:00', end: '07:00' },
                },
              },
              { id: 'admin-1', notification_settings: null },
            ];
          }
          return [{ id: 'owner-1' }, { id: 'admin-1' }];
        },
      );
    }

    function createFeedbackNotification() {
      return notifyFeedbackCreated({
        orgId: 'org-1',
        feedbackId: 'fb-1',
        title: 'Login is slow',
        category: 'performance',
        priority: 'high',
        source: 'api',
      });
    }

    it('detects a cross-midnight window (23:00-07:00)', () => {
      expect(isWithinDnd(crossMidnight, new Date(2026, 10, 10, 2, 0))).toBe(true);
      expect(isWithinDnd(crossMidnight, new Date(2026, 10, 10, 23, 0))).toBe(true);
      expect(isWithinDnd(crossMidnight, new Date(2026, 10, 10, 6, 59))).toBe(true);
      expect(isWithinDnd(crossMidnight, new Date(2026, 10, 10, 7, 0))).toBe(false);
      expect(isWithinDnd(crossMidnight, new Date(2026, 10, 10, 12, 0))).toBe(false);
    });

    it('detects a same-day window with an exclusive end', () => {
      expect(isWithinDnd(sameDay, new Date(2026, 10, 10, 9, 0))).toBe(true);
      expect(isWithinDnd(sameDay, new Date(2026, 10, 10, 12, 0))).toBe(true);
      expect(isWithinDnd(sameDay, new Date(2026, 10, 10, 17, 59))).toBe(true);
      expect(isWithinDnd(sameDay, new Date(2026, 10, 10, 18, 0))).toBe(false);
      expect(isWithinDnd(sameDay, new Date(2026, 10, 10, 8, 59))).toBe(false);
    });

    it('is inactive when disabled or when start equals end', () => {
      expect(isWithinDnd({ ...crossMidnight, enabled: false }, new Date(2026, 10, 10, 2, 0))).toBe(
        false,
      );
      expect(
        isWithinDnd({ enabled: true, start: '08:00', end: '08:00' }, new Date(2026, 10, 10, 8, 0)),
      ).toBe(false);
    });

    it('skips a recipient inside the quiet window at 02:00', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 10, 2, 0, 0));
      try {
        mockMembersWithDnd(true);

        await createFeedbackNotification();

        expect(prisma.notification.createMany).toHaveBeenCalledWith({
          data: [expect.objectContaining({ member_id: 'admin-1' })],
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('notifies everyone outside the quiet window at 12:00', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 10, 12, 0, 0));
      try {
        mockMembersWithDnd(true);

        await createFeedbackNotification();

        const data = (prisma.notification.createMany as ReturnType<typeof vi.fn>).mock
          .calls[0]?.[0] as { data: Array<{ member_id: string }> };
        expect(data.data.map((item) => item.member_id).sort()).toEqual(['admin-1', 'owner-1']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not filter anyone when DND is disabled', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 10, 2, 0, 0));
      try {
        mockMembersWithDnd(false);

        await createFeedbackNotification();

        const data = (prisma.notification.createMany as ReturnType<typeof vi.fn>).mock
          .calls[0]?.[0] as { data: Array<{ member_id: string }> };
        expect(data.data.map((item) => item.member_id).sort()).toEqual(['admin-1', 'owner-1']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('normalizes invalid stored DND times back to the defaults', async () => {
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        notification_settings: { dnd: { enabled: true, start: '25:00', end: '07:00' } },
      });

      const settings = await getNotificationSettings('admin-1', 'org-1');

      expect(settings.dnd).toEqual({ enabled: true, start: DEFAULT_DND.start, end: '07:00' });
    });

    it('persists a full DND update', async () => {
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        notification_settings: null,
      });
      (prisma.member.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const settings = await updateNotificationSettings('admin-1', 'org-1', {
        dnd: { enabled: true, start: '23:00', end: '07:00' },
      });

      expect(settings.dnd).toEqual({ enabled: true, start: '23:00', end: '07:00' });
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: { notification_settings: expect.objectContaining({ dnd: settings.dnd }) },
      });
    });

    it('keeps stored times when only the DND switch changes', async () => {
      (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        notification_settings: { dnd: { enabled: false, start: '21:00', end: '06:00' } },
      });
      (prisma.member.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const settings = await updateNotificationSettings('admin-1', 'org-1', {
        dnd: { enabled: true },
      });

      expect(settings.dnd).toEqual({ enabled: true, start: '21:00', end: '06:00' });
    });

    it.each([
      ['start hour out of range', { start: '25:00' }, '免打扰开始时间格式无效'],
      ['start missing leading zero', { start: '7:00' }, '免打扰开始时间格式无效'],
      ['end minutes out of range', { end: '08:60' }, '免打扰结束时间格式无效'],
    ])('rejects invalid time (%s)', async (_name, dnd, message) => {
      await expect(
        updateNotificationSettings('admin-1', 'org-1', { dnd }),
      ).rejects.toThrow(message);
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean enabled flag and a non-object dnd payload', async () => {
      await expect(
        updateNotificationSettings('admin-1', 'org-1', { dnd: { enabled: 'yes' } }),
      ).rejects.toThrow('免打扰开关必须是布尔值');
      await expect(
        updateNotificationSettings('admin-1', 'org-1', { dnd: 'on' }),
      ).rejects.toThrow('免打扰设置格式不正确');
      expect(prisma.member.update).not.toHaveBeenCalled();
    });
  });
});
