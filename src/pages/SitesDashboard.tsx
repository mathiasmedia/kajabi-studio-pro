/**
 * Sites Dashboard — list, create, rename, duplicate, delete sites.
 * Stored entirely in localStorage via siteStore.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listSites,
  createSite,
  duplicateSite,
  deleteSite,
  updateSite,
  enabledPageCount,
  type Site,
} from '@/lib/siteStore';
import { SitePreview } from '@/components/SitePreview';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Plus, FileText, Copy, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/AppHeader';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function SitesDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Site | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);

  async function refresh() {
    setSites(await listSites());
  }

  useEffect(() => {
    refresh();
  }, []);

  // Realtime: refresh the dashboard whenever any site row changes (insert,
  // update, delete) or any site image changes — so AI/edge-function edits in
  // an open editor tab show up here without a manual reload.
  useEffect(() => {
    const channel = supabase
      .channel('sites-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sites' },
        () => { refresh(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_images' },
        () => { refresh(); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // When admin, look up owner emails for the visible sites.
  useEffect(() => {
    if (!isAdmin || sites.length === 0) {
      setOwners({});
      return;
    }
    const userIds = Array.from(new Set(sites.map((s) => s.userId).filter(Boolean)));
    if (userIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('admin-list-site-owners', {
          body: { userIds },
        });
        if (cancelled) return;
        if (error) {
          // Non-fatal: owner emails are an admin nicety. Master may not have
          // the function deployed, or it may be temporarily 500ing.
          console.warn('[dashboard] owner emails unavailable:', error.message ?? error);
          return;
        }
        const map = (data?.owners ?? {}) as Record<string, string>;
        setOwners(map);
      } catch (err) {
        if (!cancelled) {
          console.warn('[dashboard] owner emails unavailable:', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, sites]);

  async function handleCreate(name: string) {
    const site = await createSite({ name, brandName: name });
    if (!site) return;
    await refresh();
    setCreateOpen(false);
    navigate(`/sites/${site.id}`);
  }

  async function handleDuplicate(id: string) {
    await duplicateSite(id);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deleteSite(id);
    setDeleteTarget(null);
    await refresh();
  }

  async function handleRename(id: string, newName: string) {
    await updateSite(id, { name: newName, brandName: newName });
    setRenameTarget(null);
    await refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New site
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {sites.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => {
              const isOwn = site.userId === user?.id;
              return (
                <SiteCard
                  key={site.id}
                  site={site}
                  ownerEmail={isAdmin && !isOwn ? owners[site.userId] : undefined}
                  canModify={isOwn}
                  onOpen={() => navigate(`/sites/${site.id}`)}
                  onRename={() => setRenameTarget(site)}
                  onDuplicate={() => handleDuplicate(site.id)}
                  onDelete={() => setDeleteTarget(site)}
                />
              );
            })}
          </div>
        )}
      </main>

      <CreateSiteDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />

      <RenameSiteDialog
        site={renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        onRename={handleRename}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this site?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- pieces ----------

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 border-dashed py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <FileText className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">No sites yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first site from a template to get started.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" /> Create your first site
      </Button>
    </Card>
  );
}

function SiteCard({
  site,
  ownerEmail,
  canModify,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  site: Site;
  ownerEmail?: string;
  canModify: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const pageCount = enabledPageCount(site);

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <button
        onClick={onOpen}
        className="block w-full cursor-pointer text-left"
      >
        <SitePreview site={site} />
      </button>
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <button
            onClick={onOpen}
            className="block w-full truncate text-left font-semibold hover:underline"
          >
            {site.name}
          </button>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pageCount} {pageCount === 1 ? 'page' : 'pages'} · Updated {timeAgo(site.updatedAt)}
          </p>
          {ownerEmail && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={ownerEmail}>
              Owner: <span className="font-medium text-foreground/80">{ownerEmail}</span>
            </p>
          )}
          <CopyIdButton id={site.id} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
            {canModify && <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>}
            {canModify && <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>}
            {canModify && <DropdownMenuSeparator />}
            {canModify && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const short = `${id.slice(0, 8)}…`;

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast({ title: 'Site ID copied', description: id });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }

  return (
    <button
      onClick={copy}
      title={`Copy site ID: ${id}`}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <span>ID: {short}</span>
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function CreateSiteDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new site</DialogTitle>
          <DialogDescription>Give your new site a name to get started.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="site-name">Site name</Label>
            <Input
              id="site-name"
              autoFocus
              placeholder="e.g. Acme Co"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) onCreate(name.trim());
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onCreate(name.trim() || 'Untitled site')}>
            Create site
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameSiteDialog({
  site,
  onOpenChange,
  onRename,
}: {
  site: Site | null;
  onOpenChange: (open: boolean) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (site) setName(site.name);
  }, [site]);

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename site</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && site && name.trim()) onRename(site.id, name.trim());
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => site && name.trim() && onRename(site.id, name.trim())}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
