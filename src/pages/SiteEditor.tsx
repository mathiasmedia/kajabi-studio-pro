/**
 * Site Editor — single-site preview + multi-page tab switcher + export.
 * Thin-client version: no auth.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { exportFromTree, triggerDownload } from '@/blocks';
import {
  getSite,
  updateSite,
  type PageKey,
  type Site,
} from '@/lib/siteStore';
import { getTemplate } from '@/lib/templates';
import {
  listSiteImages,
  imagesBySlot,
  generateSiteImage,
  deleteSiteImage,
  type SiteImage,
} from '@/lib/imageStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Pencil, ImagePlus, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const SYSTEM_PAGE_LABELS: Record<string, string> = {
  index: 'Home',
  about: 'About',
  page: 'Page',
  contact: 'Contact',
  blog: 'Blog',
  blog_post: 'Blog Post',
  thank_you: 'Thank You',
  '404': '404',
};

function pageLabel(key: PageKey): string {
  if (SYSTEM_PAGE_LABELS[key]) return SYSTEM_PAGE_LABELS[key];
  return key
    .split('_')
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

export default function SiteEditor() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [activePage, setActivePage] = useState<PageKey>('index');
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [images, setImages] = useState<SiteImage[]>([]);
  const [showImages, setShowImages] = useState(false);
  const [slotKey, setSlotKey] = useState('home-hero');
  const [customSlot, setCustomSlot] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    (async () => {
      const s = await getSite(siteId);
      if (cancelled) return;
      if (!s) {
        navigate('/');
        return;
      }
      setSite(s);
      setNameDraft(s.name);
      const tpl = getTemplate(s.templateId);
      if (!tpl.pageKeys.includes('index') && tpl.pageKeys.length > 0) {
        setActivePage(tpl.pageKeys[0]);
      }
      const imgs = await listSiteImages(siteId);
      if (cancelled) return;
      setImages(imgs);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, navigate]);

  const tpl = useMemo(() => (site ? getTemplate(site.templateId) : null), [site]);
  const slotMap = useMemo(() => imagesBySlot(images), [images]);

  useEffect(() => {
    if (!tpl?.fonts) return;
    const families: string[] = [];
    const seen = new Set<string>();
    const add = (name?: string) => {
      if (!name) return;
      const key = name.trim();
      if (!key || seen.has(key.toLowerCase())) return;
      seen.add(key.toLowerCase());
      families.push(`${key.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800`);
    };
    add(tpl.fonts.heading);
    add(tpl.fonts.body);
    tpl.fonts.extras?.forEach(add);
    if (families.length === 0) return;
    const href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.previewFonts = tpl.id;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [tpl]);

  async function commitName() {
    if (!site) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === site.name) {
      setEditingName(false);
      setNameDraft(site.name);
      return;
    }
    const updated = await updateSite(site.id, { name: trimmed, brandName: trimmed });
    if (updated) setSite(updated);
    setEditingName(false);
  }

  async function handleExport() {
    if (!site || !tpl) return;
    setBusy(true);
    try {
      const trees = tpl.buildPages(site, slotMap);
      const fonts = tpl.fonts;
      const global = fonts
        ? {
            headingFont: fonts.heading,
            bodyFont: fonts.body,
            fontImports: (fonts.extras ?? []).map((name) => {
              const slug = name.trim().replace(/\s+/g, '+');
              return `https://fonts.googleapis.com/css2?family=${slug}:wght@400;500;600;700;800&display=swap`;
            }),
          }
        : undefined;
      const blob = await exportFromTree(trees, {
        global,
        themeSettings: tpl.themeSettings,
        customCss: tpl.customCss,
      });
      const safe = site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
      triggerDownload(blob, `${safe}.zip`);
    } catch (err) {
      console.error(err);
      alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const slotOptions = useMemo(() => {
    const fromTemplate = tpl?.imageSlots?.map((s) => s.key) ?? [];
    const fromImages = images.map((i) => i.slot).filter((s): s is string => !!s);
    const all = new Set<string>(['home-hero', ...fromTemplate, ...fromImages]);
    return Array.from(all);
  }, [tpl, images]);

  async function refreshImages() {
    if (!siteId) return;
    const next = await listSiteImages(siteId);
    setImages(next);
  }

  async function handleGenerate() {
    if (!siteId) return;
    const slot = (slotKey === '__custom' ? customSlot : slotKey).trim();
    const trimmedPrompt = prompt.trim();
    if (!slot) {
      toast.error('Pick or enter a slot key');
      return;
    }
    if (!trimmedPrompt) {
      toast.error('Describe the image you want');
      return;
    }
    setGenerating(true);
    try {
      const { image, error } = await generateSiteImage(siteId, {
        prompt: trimmedPrompt,
        slot,
      });
      if (error || !image) {
        toast.error(error ?? 'Generation failed');
        return;
      }
      toast.success(`Image generated for "${slot}"`);
      setPrompt('');
      await refreshImages();
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteImage(img: SiteImage) {
    await deleteSiteImage(img);
    await refreshImages();
    toast.success('Image removed');
  }

  if (!site || !tpl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading site…
      </div>
    );
  }

  const PreviewPage = tpl.renderPage(site, activePage, slotMap);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" /> All sites
          </Button>
          <div className="h-6 w-px bg-border" />
          {editingName ? (
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') {
                  setNameDraft(site.name);
                  setEditingName(false);
                }
              }}
              className="h-8 w-48"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm font-semibold hover:bg-muted"
            >
              {site.name}
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <span className="hidden text-xs text-muted-foreground sm:inline">
            · {tpl.label} · {tpl.pageKeys.length} {tpl.pageKeys.length === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <Select value={activePage} onValueChange={(v) => setActivePage(v as PageKey)}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder="Select page" />
          </SelectTrigger>
          <SelectContent>
            {tpl.pageKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {pageLabel(key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowImages((s) => !s)}
            variant={showImages ? 'default' : 'outline'}
            size="sm"
          >
            <ImagePlus className="h-4 w-4" />
            Images {images.length > 0 ? `(${images.length})` : ''}
          </Button>
          <Button onClick={handleExport} disabled={busy} size="sm">
            <Download className="h-4 w-4" />
            {busy ? 'Building zip…' : 'Export theme'}
          </Button>
        </div>
      </div>

      <div className="flex">
        {showImages && (
          <aside className="sticky top-[57px] h-[calc(100vh-57px)] w-80 shrink-0 overflow-y-auto border-r border-border bg-background p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              Generate image
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Pick a slot (e.g. <code className="rounded bg-muted px-1">home-hero</code>) and describe the image.
            </p>

            <label className="mb-1 block text-xs font-medium">Slot</label>
            <Select value={slotKey} onValueChange={setSlotKey}>
              <SelectTrigger className="mb-2 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {slotOptions.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
                <SelectItem value="__custom">Custom slot…</SelectItem>
              </SelectContent>
            </Select>
            {slotKey === '__custom' && (
              <Input
                placeholder="my-custom-slot"
                value={customSlot}
                onChange={(e) => setCustomSlot(e.target.value)}
                className="mb-2 h-9"
              />
            )}

            <label className="mb-1 block text-xs font-medium">Prompt</label>
            <Textarea
              placeholder="A bright airy hero image of a coastal kitchen with morning light…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="mb-2"
            />

            <Button
              onClick={handleGenerate}
              disabled={generating}
              size="sm"
              className="w-full"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? 'Generating…' : 'Generate with AI'}
            </Button>

            <div className="mt-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Library ({images.length})
              </h3>
              {images.length === 0 ? (
                <p className="text-xs text-muted-foreground">No images yet.</p>
              ) : (
                <ul className="space-y-2">
                  {images.map((img) => (
                    <li
                      key={img.id}
                      className="flex items-center gap-2 rounded border border-border p-2"
                    >
                      <img
                        src={img.url}
                        alt={img.alt}
                        className="h-12 w-12 shrink-0 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {img.slot ?? 'no slot'}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {img.prompt ?? img.alt}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteImage(img)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">{PreviewPage}</div>
      </div>
    </div>
  );
}
