import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { PageFallback } from '@/components/PageFallback';
import type { OrgMemberRole } from '@/types';
import { Login } from '@/pages/Login';

// The public landing page is its own chunk: logged-in users who go straight to
// /dashboard never download the marketing markup or its page-scoped CSS.
const Landing = lazy(() =>
  import('@/pages/Landing').then((m) => ({ default: m.Landing })),
);

// Route chunks keep the first paint small; recharts and the settings-heavy
// pages only load when they are actually opened.
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const FeedbackList = lazy(() =>
  import('@/pages/FeedbackList').then((m) => ({ default: m.FeedbackList })),
);
const FeedbackDetail = lazy(() =>
  import('@/pages/FeedbackDetail').then((m) => ({ default: m.FeedbackDetail })),
);
const Applications = lazy(() =>
  import('@/pages/Applications').then((m) => ({ default: m.Applications })),
);
const ProjectSettings = lazy(() =>
  import('@/pages/ProjectSettings').then((m) => ({ default: m.ProjectSettings })),
);
const Members = lazy(() => import('@/pages/Members').then((m) => ({ default: m.Members })));
const Tags = lazy(() => import('@/pages/Tags').then((m) => ({ default: m.Tags })));
const Changelog = lazy(() => import('@/pages/Changelog').then((m) => ({ default: m.Changelog })));
const OrgSettings = lazy(() =>
  import('@/pages/OrgSettings').then((m) => ({ default: m.OrgSettings })),
);
const Webhooks = lazy(() => import('@/pages/Webhooks').then((m) => ({ default: m.Webhooks })));
const StatusSettings = lazy(() =>
  import('@/pages/StatusSettings').then((m) => ({ default: m.StatusSettings })),
);
const WidgetConfig = lazy(() =>
  import('@/pages/WidgetConfig').then((m) => ({ default: m.WidgetConfig })),
);
const SystemConfig = lazy(() =>
  import('@/pages/SystemConfig').then((m) => ({ default: m.SystemConfig })),
);
const Notifications = lazy(() =>
  import('@/pages/Notifications').then((m) => ({ default: m.Notifications })),
);
const Categories = lazy(() =>
  import('@/pages/Categories').then((m) => ({ default: m.Categories })),
);
const AuditLogs = lazy(() => import('@/pages/AuditLogs').then((m) => ({ default: m.AuditLogs })));
const NotificationsCenter = lazy(() =>
  import('@/pages/NotificationsCenter').then((m) => ({ default: m.NotificationsCenter })),
);
const AcceptInvite = lazy(() =>
  import('@/pages/AcceptInvite').then((m) => ({ default: m.AcceptInvite })),
);

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Login />;
  }
  return <Layout>{children}</Layout>;
}

function RoleRoute({ children, roles }: { children: ReactNode; roles: OrgMemberRole[] }) {
  const { isAuthenticated, member } = useAuth();
  if (!isAuthenticated) {
    return <Login />;
  }
  if (!member || !roles.includes(member.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <Suspense fallback={<PageFallback />}>
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<PageFallback />}>
            <Landing />
          </Suspense>
        }
      />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/feedback" element={<ProtectedRoute><FeedbackList /></ProtectedRoute>} />
      <Route path="/feedback/:id" element={<ProtectedRoute><FeedbackDetail /></ProtectedRoute>} />
      <Route path="/changelog" element={<ProtectedRoute><Changelog /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsCenter /></ProtectedRoute>} />
      <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
      <Route path="/projects/:projectId/settings" element={<RoleRoute roles={['owner', 'admin']}><ProjectSettings /></RoleRoute>} />
      <Route path="/projects/:projectId/widget" element={<RoleRoute roles={['owner', 'admin']}><WidgetConfig /></RoleRoute>} />
      <Route path="/members" element={<RoleRoute roles={['owner', 'admin']}><Members /></RoleRoute>} />
      <Route path="/tags" element={<RoleRoute roles={['owner', 'admin']}><Tags /></RoleRoute>} />
      <Route path="/projects/:projectId/webhooks" element={<RoleRoute roles={['owner', 'admin']}><Webhooks /></RoleRoute>} />
      <Route path="/projects/:projectId/statuses" element={<RoleRoute roles={['owner', 'admin']}><StatusSettings /></RoleRoute>} />
      <Route path="/projects/:projectId/notifications" element={<RoleRoute roles={['owner', 'admin']}><Notifications /></RoleRoute>} />
      <Route path="/projects/:projectId/categories" element={<RoleRoute roles={['owner', 'admin']}><Categories /></RoleRoute>} />
      <Route path="/audit-logs" element={<RoleRoute roles={['owner', 'admin']}><AuditLogs /></RoleRoute>} />
      <Route path="/settings" element={<RoleRoute roles={['owner']}><OrgSettings /></RoleRoute>} />
      <Route path="/system-config" element={<RoleRoute roles={['owner']}><SystemConfig /></RoleRoute>} />
      <Route path="/invite-accept" element={<PublicRoute><AcceptInvite /></PublicRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
