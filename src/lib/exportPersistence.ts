/**
 * Export persistence — uploads a freshly-built Kajabi theme zip to the
 * `site-exports` storage bucket and updates the site row with a stable
 * public URL pointing at the latest build.
 */
import { supabase } from '@/integrations/supabase/client';
import { updateSite, type Site } from './siteStore';

const BUCKET = 'site-exports';

export interface PersistExportResult {
  ok: boolean;
  latestUrl: string | null;
  latestAt: string | null;
  error?: string;
}

export async function persistExportZip(
  site: Pick<Site, 'id' | 'userId'>,
  blob: Blob,
): Promise<PersistExportResult> {
  try {
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const folder = `${site.userId}/${site.id}`;
    const latestPath = `${folder}/latest.zip`;
    const historyPath = `${folder}/history/${stamp}.zip`;

    const [latestUp, historyUp] = await Promise.all([
      supabase.storage.from(BUCKET).upload(latestPath, blob, {
        contentType: 'application/zip',
        upsert: true,
        cacheControl: '0',
      }),
      supabase.storage.from(BUCKET).upload(historyPath, blob, {
        contentType: 'application/zip',
        upsert: false,
        cacheControl: '31536000',
      }),
    ]);

    if (latestUp.error) {
      return {
        ok: false,
        latestUrl: null,
        latestAt: null,
        error: `latest.zip upload failed: ${latestUp.error.message}`,
      };
    }
    if (historyUp.error && !/(already exists|duplicate|conflict)/i.test(historyUp.error.message)) {
      console.warn('[exportPersistence] history upload failed (non-fatal):', historyUp.error);
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(latestPath);
    const latestUrl = `${pub.publicUrl}?v=${stamp}`;
    const latestAt = now.toISOString();

    const updated = await updateSite(site.id, {
      latestExportUrl: latestUrl,
      latestExportAt: latestAt,
    });
    if (!updated) {
      return {
        ok: false,
        latestUrl,
        latestAt,
        error: 'Uploaded but failed to update site row',
      };
    }

    return { ok: true, latestUrl, latestAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[exportPersistence] persistExportZip failed:', e);
    return { ok: false, latestUrl: null, latestAt: null, error: message };
  }
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}
