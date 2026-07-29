import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Login />;
  }
  return <Layout>{children}</Layout>;
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
      <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
      <Route path="/tags" element={<ProtectedRoute><Tags /></ProtectedRoute>} />
      <Route path="/projects/:projectId/webhooks" element={<ProtectedRoute><Webhooks /></ProtectedRoute>} />
      <Route path="/projects/:projectId/statuses" element={<ProtectedRoute><StatusSettings /></ProtectedRoute>} />
      <Route path="/projects/:projectId/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/projects/:projectId/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><OrgSettings /></ProtectedRoute>} />
      <Route path="/system-config" element={<ProtectedRoute><SystemConfig /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
