import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Globe, ExternalLink, RefreshCw, Trash2, MessageSquare, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  listSites,
  listFeedback,
  setFeedbackEnabled,
  setFeedbackStatus,
  deleteFeedback,
  removeSiteRecord,
} from "@/lib/db.functions";
import { deleteSite, getSiteStatus } from "@/lib/cf.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Мои сайты и замечания клиентов — Pixelift Deploy" },
      {
        name: "description",
        content:
          "Управляйте опубликованными сайтами на Cloudflare Pages, следите за статусом деплоя и разбирайте замечания клиентов по каждому элементу страницы.",
      },
      { property: "og:title", content: "Панель управления Pixelift Deploy" },
      {
        property: "og:description",
        content: "Сайты, статусы деплоя и клиентские замечания в одном месте.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type SiteRow = {
  id: string;
  project_name: string;
  url: string;
  title: string;
  feedback_token: string;
  feedback_enabled: boolean;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  kind: string;
  selector: string;
  element_label: string;
  breadcrumb?: string;
  element_html?: string;
  message: string;
  author_name: string;
  page_url: string;
  status: string;
  created_at: string;
};

function Dashboard() {
  const { user, signOut } = useAuth();
  const fetchSites = useServerFn(listSites);
  const fetchFeedback = useServerFn(listFeedback);
  const toggleFeedback = useServerFn(setFeedbackEnabled);
  const markFeedback = useServerFn(setFeedbackStatus);
  const dropFeedback = useServerFn(deleteFeedback);
  const dropRecord = useServerFn(removeSiteRecord);
  const dropCfSite = useServerFn(deleteSite);
  const status = useServerFn(getSiteStatus);

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = (await fetchSites()) as SiteRow[];
      setSites(rows);
      if (rows.length && !active) setActive(rows[0]!.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить сайты");
    }
  }, [fetchSites, active]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFeedback = useCallback(
    async (siteId: string) => {
      try {
        setItems((await fetchFeedback({ data: { siteId } })) as FeedbackRow[]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не удалось загрузить замечания");
      }
    },
    [fetchFeedback],
  );

  useEffect(() => {
    if (active) void loadFeedback(active);
  }, [active, loadFeedback]);

  const site = sites.find((s) => s.id === active) ?? null;

  async function refreshStatus(s: SiteRow) {
    setBusy(true);
    try {
      const r = await status({ data: { projectName: s.project_name } });
      toast.success(`Статус: ${r.stage} — ${r.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось получить статус");
    } finally {
      setBusy(false);
    }
  }

  async function destroy(s: SiteRow) {
    if (!window.confirm(`Удалить сайт ${s.project_name} из Cloudflare Pages?`)) return;
    setBusy(true);
    try {
      await dropCfSite({ data: { projectName: s.project_name } });
      await dropRecord({ data: { projectName: s.project_name } });
      setSites((prev) => prev.filter((x) => x.id !== s.id));
      if (active === s.id) setActive(null);
      toast.success("Сайт удалён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить сайт");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">Мои сайты</h1>
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/">Загрузить архив</Link>
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Выйти
          </Button>
        </div>
      </header>

      {sites.length === 0 && (
        <p className="text-muted-foreground">
          Пока нет опубликованных сайтов. Загрузите ZIP-архив на главной странице.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-3">
          {sites.map((s) => (
            <div
              key={s.id}
              className={`panel cursor-pointer p-4 ${active === s.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setActive(s.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Globe className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">{s.title || s.project_name}</p>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm break-all text-accent hover:underline"
                  >
                    {s.url}
                  </a>
                </div>
                <Badge variant="secondary">опубликован</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Открыть
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void refreshStatus(s);
                  }}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    void navigator.clipboard.writeText(s.url);
                    toast.success("Ссылка скопирована");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <label
                  className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  Приём замечаний
                  <Switch
                    checked={s.feedback_enabled}
                    onCheckedChange={(v) => {
                      setSites((prev) =>
                        prev.map((x) => (x.id === s.id ? { ...x, feedback_enabled: v } : x)),
                      );
                      void toggleFeedback({ data: { id: s.id, enabled: v } });
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void destroy(s);
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className="panel h-fit p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <MessageSquare className="size-4 text-primary" />
            Замечания клиентов {site ? `— ${site.project_name}` : ""}
          </h2>
          {!site && <p className="mt-2 text-sm text-muted-foreground">Выберите сайт слева.</p>}
          {site && items.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Замечаний пока нет.</p>
          )}
          <div className="mt-4 space-y-3">
            {items.map((f) => (
              <div
                key={f.id}
                className={`rounded-xl border border-border p-3 ${f.status === "done" ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{f.kind}</Badge>
                  <span>{f.author_name || "аноним"}</span>
                  <span>{new Date(f.created_at).toLocaleString("ru-RU")}</span>
                </div>
                <p className="mt-2 text-sm">{f.message}</p>
                {(f.element_label || f.selector) && (
                  <div className="mt-2 rounded-lg border border-border bg-surface-2 p-2">
                    <p className="text-xs font-medium">
                      {f.element_label || "Элемент страницы"}
                    </p>
                    {f.breadcrumb && (
                      <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                        {f.breadcrumb}
                      </p>
                    )}
                    {f.selector && (
                      <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                        CSS: {f.selector}
                      </p>
                    )}
                    {f.element_html && (
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-background p-2 font-mono text-[10px] whitespace-pre-wrap text-muted-foreground">
                        {f.element_html}
                      </pre>
                    )}
                    {f.page_url && f.selector && (
                      <a
                        className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        href={`${f.page_url}#pxfb=${encodeURIComponent(f.selector)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-3" /> Показать этот элемент на сайте
                      </a>
                    )}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = f.status === "done" ? "open" : "done";
                      setItems((prev) =>
                        prev.map((x) => (x.id === f.id ? { ...x, status: next } : x)),
                      );
                      void markFeedback({ data: { id: f.id, status: next } });
                    }}
                  >
                    <Check className="size-4" />
                    {f.status === "done" ? "Вернуть" : "Готово"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setItems((prev) => prev.filter((x) => x.id !== f.id));
                      void dropFeedback({ data: { id: f.id } });
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
