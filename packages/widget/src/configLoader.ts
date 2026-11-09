export type ServerWidgetConfig = {
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  buttonLabel?: string;
  successTitle?: string;
  successMessage?: string;
  fields?: { priority?: boolean; contact?: boolean; category?: boolean };
  project?: { slug?: string; name?: string };
};

export async function loadWidgetConfig(apiUrl: string, apiKey: string): Promise<ServerWidgetConfig | null> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/widget/config`, {
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.code !== 0) return null;
    const widget = json.data?.widget ?? {};
    return { ...widget, project: json.data?.project ?? undefined };
  } catch {
    return null;
  }
}
