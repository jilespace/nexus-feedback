import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import type { OrgMemberRole } from '@/types';
import { Login } from '@/pages/Login';
import { Landing } from '@/pages/Landing';
import { Dashboard } from '@/pages/Dashboard';
import { FeedbackList } from '@/pages/FeedbackList';
import { FeedbackDetail } from '@/pages/FeedbackDetail';
import { Applications } from '@/pages/Applications';
import { ProjectSettings } from '@/pages/ProjectSettings';
import { Members } from '@/pages/Members';
import { Tags } from '@/pages/Tags';
import { Changelog } from '@/pages/Changelog';
import { OrgSettings } from '@/pages/OrgSettings';
import { Webhooks } from '@/pages/Webhooks';
import { StatusSettings } from '@/pages/StatusSettings';
import { WidgetConfig } from '@/pages/WidgetConfig';
import { SystemConfig } from '@/pages/SystemConfig';
import { Notifications } from '@/pages/Notifications';
import { Categories } from '@/pages/Categories';
import { AuditLogs } from '@/pages/AuditLogs';
import { AcceptInvite } from '@/pages/AcceptInvite';

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
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/feedback" element={<ProtectedRoute><FeedbackList /></ProtectedRoute>} />
      <Route path="/feedback/:id" element={<ProtectedRoute><FeedbackDetail /></ProtectedRoute>} />
      <Route path="/changelog" element={<ProtectedRoute><Changelog /></ProtectedRoute>} />
      <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
      <Route path="/projects/:projectId/settings" element={<ProtectedRoute><ProjectSettings /></ProtectedRoute>} />
      <Route path="/projects/:projectId/widget" element={<ProtectedRoute><WidgetConfig /></ProtectedRoute>} />
      <Route path="/members" element={<RoleRoute roles={['owner', 'admin']}><Members /></RoleRoute>} />
      <Route path="/tags" element={<RoleRoute roles={['owner', 'admin']}><Tags /></RoleRoute>} />
      <Route path="/projects/:projectId/settings" element={<RoleRoute roles={['owner', 'admin']}><ProjectSettings /></RoleRoute>} />
      <Route path="/projects/:projectId/widget" element={<RoleRoute roles={['owner', 'admin']}><WidgetConfig /></RoleRoute>} />
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
