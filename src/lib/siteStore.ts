/**
 * Site store — Supabase-backed CRUD for the multi-site dashboard.
 * Talks to the master Supabase project via @/integrations/supabase/client.
 */
import { supabase } from '@/integrations/supabase/client';
import type { SiteDesign } from './siteDesign/types';
import { isSiteDesign } from './siteDesign/types';
import { buildBlankDesign } from './siteDesign/blank';

export type SystemPageKey =
  | 'index' | 'about' | 'page' | 'contact'
  | 'blog' | 'blog_post' | 'thank_you' | '404';

export const SYSTEM_PAGE_KEYS: ReadonlyArray<SystemPageKey> = [
  'index', 'about', 'page', 'contact', 'blog', 'blog_post', 'thank_you', '404',
];

export type PageKey = SystemPageKey | (string & {});

export interface Site {
  id: string;
  name: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
  brandName: string;
  pages: Partial<Record<PageKey, { enabled: boolean }>>;
  userId: string;
  design: SiteDesign | null;
}

function rowToSite(row: {
  id: string; name: string; template_id: string; brand_name: string;
  pages: unknown; design?: unknown; created_at: string; updated_at: string; user_id: string;
}): Site {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    brandName: row.brand_name,
    pages: (row.pages ?? {}) as Site['pages'],
    design: isSiteDesign(row.design) ? row.design : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

export async function listSites(): Promise<Site[]> {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[siteStore] listSites failed:', error);
    return [];
  }
  return (data ?? []).map(rowToSite);
}

export async function getSite(id: string): Promise<Site | null> {
  const { data, error } = await supabase.from('sites').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[siteStore] getSite failed:', error);
    return null;
  }
  if (!data) return null;
  return rowToSite(data);
}

export async function createSite(opts: {
  name: string; brandName?: string;
}): Promise<Site | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    console.error('[siteStore] createSite: not authenticated');
    return null;
  }
  const name = opts.name.trim() || 'Untitled site';
  const brand = opts.brandName?.trim() || name;
  const design = buildBlankDesign(brand);
  const { data, error } = await supabase
    .from('sites')
    .insert({
      user_id: userId,
      name,
      template_id: 'blank',
      brand_name: brand,
      pages: {},
      design: design as never,
    })
    .select()
    .single();
  if (error) {
    console.error('[siteStore] createSite failed:', error);
    return null;
  }
  return rowToSite(data);
}

export async function updateSite(
  id: string,
  patch: Partial<Omit<Site, 'id' | 'createdAt' | 'templateId' | 'userId'>>
): Promise<Site | null> {
  const row: { name?: string; brand_name?: string; pages?: Site['pages']; design?: SiteDesign; } = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.brandName !== undefined) row.brand_name = patch.brandName;
  if (patch.pages !== undefined) row.pages = patch.pages;
  if (patch.design !== undefined && patch.design !== null) row.design = patch.design;
  const { data, error } = await supabase
    .from('sites')
    .update(row as never)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[siteStore] updateSite failed:', error);
    return null;
  }
  return rowToSite(data);
}

export async function duplicateSite(id: string): Promise<Site | null> {
  const original = await getSite(id);
  if (!original) return null;
  const copy = await createSite({
    name: `${original.name} (copy)`,
    brandName: original.brandName,
  });
  if (!copy || !original.design) return copy;
  return updateSite(copy.id, { design: original.design });
}

export async function deleteSite(id: string): Promise<void> {
  const { error } = await supabase.from('sites').delete().eq('id', id);
  if (error) console.error('[siteStore] deleteSite failed:', error);
}

export function enabledPageCount(site: Site): number {
  return SYSTEM_PAGE_KEYS.filter((k) => site.pages[k]?.enabled !== false).length;
}
