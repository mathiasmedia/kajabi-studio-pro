/**
 * Site store — thin-client localStorage version.
 *
 * Mirrors the master app's async API exactly so templates/pages don't need
 * to know there's no backend. Sites live under a single localStorage key
 * (`thin-client.sites.v1`) as a JSON array.
 */

const LS_KEY = 'thin-client.sites.v1';

export type SystemPageKey =
  | 'index'
  | 'about'
  | 'page'
  | 'contact'
  | 'blog'
  | 'blog_post'
  | 'thank_you'
  | '404';

export const SYSTEM_PAGE_KEYS: ReadonlyArray<SystemPageKey> = [
  'index', 'about', 'page', 'contact', 'blog', 'blog_post', 'thank_you', '404',
];

export type PageKey = SystemPageKey | (string & {});

export type TemplateId =
  | 'pixel-perfect'
  | 'blank'
  | 'builder-pro'
  | 'coastal-calm'
  | 'calm-ledger'
  | 'sunday-table'
  | 'quiet-trail'
  | 'cooking-to-overcome'
  | 'go-make-a-dollar'
  | 'auticate';

export interface Site {
  id: string;
  name: string;
  templateId: TemplateId;
  createdAt: string;
  updatedAt: string;
  brandName: string;
  pages: Partial<Record<PageKey, { enabled: boolean }>>;
}

// ---- raw read/write ----

function readAll(): Site[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Site[]) : [];
  } catch (e) {
    console.error('[siteStore] read failed:', e);
    return [];
  }
}

function writeAll(sites: Site[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sites));
  } catch (e) {
    console.error('[siteStore] write failed:', e);
  }
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- public API (async to match master) ----

export async function listSites(): Promise<Site[]> {
  const all = readAll();
  return [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSite(id: string): Promise<Site | null> {
  return readAll().find((s) => s.id === id) ?? null;
}

export async function createSite(opts: {
  name: string;
  templateId: TemplateId;
  brandName?: string;
}): Promise<Site | null> {
  const name = opts.name.trim() || 'Untitled site';
  const brand = opts.brandName?.trim() || name;
  const now = new Date().toISOString();
  const site: Site = {
    id: uid(),
    name,
    templateId: opts.templateId,
    brandName: brand,
    pages: {},
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(site);
  writeAll(all);
  return site;
}

export async function updateSite(
  id: string,
  patch: Partial<Omit<Site, 'id' | 'createdAt'>>,
): Promise<Site | null> {
  const all = readAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const next: Site = {
    ...all[idx],
    ...patch,
    id: all[idx].id,
    createdAt: all[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  writeAll(all);
  return next;
}

export async function duplicateSite(id: string): Promise<Site | null> {
  const original = await getSite(id);
  if (!original) return null;
  return createSite({
    name: `${original.name} (copy)`,
    templateId: original.templateId,
    brandName: original.brandName,
  });
}

export async function deleteSite(id: string): Promise<void> {
  const all = readAll().filter((s) => s.id !== id);
  writeAll(all);
}

export function enabledPageCount(site: Site): number {
  return SYSTEM_PAGE_KEYS.filter((k) => site.pages[k]?.enabled !== false).length;
}
