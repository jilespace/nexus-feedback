import { prisma } from '../db/client.js';
import { getDefaultStatuses } from './statusConfig.js';

type BoardConfigProject = {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  widget_config?: string | null;
};

export async function getBoardConfig(project: BoardConfigProject) {
  const [org, statusConfigs] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: project.org_id },
      select: { name: true, logo_url: true, brand_color: true },
    }),
    prisma.statusConfig.findMany({
      where: { project_id: project.id },
      orderBy: { position: 'asc' },
    }),
  ]);

  let widget: Record<string, unknown> = {};
  if (project.widget_config) {
    try {
      widget = JSON.parse(project.widget_config);
    } catch {
      widget = {};
    }
  }

  return {
    project: { id: project.id, name: project.name, slug: project.slug },
    organization: org ?? null,
    widget,
    roadmap:
      statusConfigs.length > 0
        ? statusConfigs.map((s) => ({
            name: s.name,
            color: s.color,
            position: s.position,
            is_closed: s.is_closed,
          }))
        : getDefaultStatuses(),
  };
}
