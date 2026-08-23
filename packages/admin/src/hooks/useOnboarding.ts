import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import type { ProjectAccessInfo } from '@/types';

export function useFirstProject(): { projectId: string; slug: string } | null {
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest<ProjectAccessInfo[]>('/org/projects'),
  });
  const first = data?.[0];
  return first ? { projectId: first.id, slug: first.slug } : null;
}
