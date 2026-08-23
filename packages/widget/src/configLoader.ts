export type ServerWidgetConfig = {
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  buttonLabel?: string;
  successTitle?: string;
  successMessage?: string;
  fields?: { priority?: boolean; contact?: boolean; category?: boolean };
};

export async function loadWidgetConfig(apiUrl: string, apiKey: string): Promise<ServerWidgetConfig | null> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/widget/config`, {
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.code === 0 ? (json.data?.widget ?? {}) : null;
  } catch {
    return null;
  }
}
