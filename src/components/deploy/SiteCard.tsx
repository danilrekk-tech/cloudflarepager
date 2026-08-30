import { useState } from "react";
import { ExternalLink, Copy, RefreshCw, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { deleteSite, getSiteStatus } from "@/lib/cf.functions";
import type { StoredSite } from "@/lib/sites";

export function SiteCard({
  site,
  onRemoved,
  onRedeploy,
}: {
  site: StoredSite;
  onRemoved: (name: string) => void;
  onRedeploy?: (name: string) => void;
}) {
  const status = useServerFn(getSiteStatus);
  const remove = useServerFn(deleteSite);
  const [state, setState] = useState<{ status: string; stage: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const r = await status({ data: { projectName: site.projectName } });
      setState({ status: r.status, stage: r.stage });
      toast.success(`Статус: ${r.stage} — ${r.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось получить статус");
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!window.confirm(`Удалить сайт ${site.projectName} из Cloudflare Pages?`)) return;
    setBusy(true);
    try {
      await remove({ data: { projectName: site.projectName } });
      onRemoved(site.projectName);
      toast.success("Сайт удалён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить сайт");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel flex flex-wrap items-center gap-4 p-4">
      <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <Globe className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold">{site.title}</p>
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm break-all text-accent hover:underline"
        >
          {site.url}
        </a>
      </div>
      <Badge variant={state?.status === "failure" ? "destructive" : "secondary"}>
        {state ? `${state.stage}: ${state.status}` : "опубликован"}
      </Badge>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={site.url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Открыть
          </a>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(site.url);
            toast.success("Ссылка скопирована");
          }}
        >
          <Copy className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={refresh}>
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
        </Button>
        {onRedeploy && (
          <Button size="sm" variant="secondary" onClick={() => onRedeploy(site.projectName)}>
            Передеплоить
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={destroy}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
