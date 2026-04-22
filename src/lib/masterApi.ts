/**
 * Master-app fetch helper.
 *
 * The thin client doesn't have its own backend — instead it talks to the
 * master Kajabi Export Kit's Supabase Edge Functions (generate-site-image,
 * firecrawl-scrape) using a shared `X-App-Token` header.
 *
 * Configure via env vars:
 *   - VITE_MASTER_SUPABASE_URL    e.g. https://xxxx.supabase.co
 *   - VITE_THIN_CLIENT_APP_TOKEN  shared secret matching the master's
 *                                  THIN_CLIENT_APP_TOKEN env var
 */
const MASTER_URL = import.meta.env.VITE_MASTER_SUPABASE_URL as string | undefined;
const APP_TOKEN = import.meta.env.VITE_THIN_CLIENT_APP_TOKEN as string | undefined;

export function masterConfigured(): boolean {
  return !!MASTER_URL && !!APP_TOKEN;
}

export function masterFunctionUrl(name: string): string {
  if (!MASTER_URL) {
    throw new Error('VITE_MASTER_SUPABASE_URL is not configured');
  }
  return `${MASTER_URL.replace(/\/$/, '')}/functions/v1/${name}`;
}

/**
 * POST a JSON body to a master edge function with the X-App-Token header.
 * Returns parsed JSON or throws with the server-supplied error message.
 */
export async function callMaster<T = unknown>(
  fn: 'generate-site-image' | 'firecrawl-scrape',
  body: Record<string, unknown>,
): Promise<T> {
  if (!APP_TOKEN) {
    throw new Error('VITE_THIN_CLIENT_APP_TOKEN is not configured');
  }
  const res = await fetch(masterFunctionUrl(fn), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Token': APP_TOKEN,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null) ?? `Master ${fn} failed: ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
