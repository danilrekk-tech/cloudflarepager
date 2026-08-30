import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Rocket, Loader2, PackageSearch, ShieldCheck, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropzone } from "@/components/deploy/Dropzone";
import { CheckList } from "@/components/deploy/CheckList";
import { SitePreview } from "@/components/deploy/SitePreview";
import { EditorOverlay, type Upload } from "@/components/deploy/EditorOverlay";
import { SiteCard } from "@/components/deploy/SiteCard";
import { readZip, formatBytes, type FileMap } from "@/lib/pipeline/zip";
import { buildSite, composeHtml, makeTextFile, type BuildResult } from "@/lib/pipeline/build";
import type { Patch } from "@/lib/pipeline/overrides";
import { deploySite } from "@/lib/cf.functions";
import { useSites, toBase64 } from "@/lib/sites";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pixelift Deploy — ZIP-архив в живой сайт на Cloudflare Pages" },
      {
        name: "description",
        content:
          "Загрузите ZIP с сайтом: сервис проверит, чего не хватает, автоматически починит, соберёт статику и опубликует на Cloudflare Pages с рабочей ссылкой.",
      },
      { property: "og:title", content: "Pixelift Deploy — ZIP в сайт на Cloudflare Pages" },
      {
        property: "og:description",
        content:
          "Автоматический аудит архива, починка, сборка в браузере и публикация на Cloudflare Pages за один шаг.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Phase = "idle" | "analyzing" | "ready" | "deploying" | "done";

function slugFromName(name: string) {
  return (
    name
      .replace(/\.zip$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "site"
  );
}

function Index() {
  const deploy = useServerFn(deploySite);
  const { sites, addSite, removeSite } = useSites();

  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [files, setFiles] = useState<FileMap | null>(null);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [navStub, setNavStub] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setPhase("analyzing");
    setError(null);
    setResult(null);
    setPatches([]);
    setFileName(file.name);
    try {
      const map = readZip(await file.arrayBuffer());
      setFiles(map);
      const slug = slugFromName(file.name);
      setProjectName(slug);
      const built = await buildSite(map, { title: slug, patches: [], navStub });
      setResult(built);
      setPhase("ready");
      toast.success("Архив проанализирован и подготовлен к публикации");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
      toast.error("Не удалось обработать архив");
    }
  }

  async function handleDeploy() {
    if (!result) return;
    setPhase("deploying");
    try {
      const html = composeHtml(result.baseHtml, patches, navStub);
      const outFiles = result.files.map((f) =>
        f.path === "index.html" || f.path === "404.html" ? makeTextFile(f.path, html) : f,
      );
      const payload = outFiles.map((f) => ({
        path: f.path,
        base64: toBase64(f.bytes),
        contentType: f.contentType,
      }));
      const res = await deploy({ data: { projectName, files: payload } });
      addSite({
        projectName: res.projectName,
        url: res.url,
        createdAt: new Date().toISOString(),
        title: fileName ?? res.projectName,
      });
      setPhase("done");
      toast.success("Сайт опубликован на Cloudflare Pages");
    } catch (e) {
      setPhase("ready");
      toast.error(e instanceof Error ? e.message : "Ошибка публикации");
    }
  }

  const busy = phase === "analyzing" || phase === "deploying";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:py-16">
      <header className="mb-10 flex flex-col gap-4">
        <Badge variant="outline" className="w-fit border-primary/40 text-primary">
          ZIP → живой сайт
        </Badge>
        <h1 className="max-w-3xl text-4xl font-bold md:text-6xl">
          Загрузите архив — получите работающий сайт на Cloudflare&nbsp;Pages
        </h1>
        <p className="max-w-2xl text-muted-foreground md:text-lg">
          Сервис разбирает архив, находит чего не хватает для статического хостинга, чинит это
          автоматически, собирает исходники React прямо в браузере и публикует результат.
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <PackageSearch className="size-4 text-primary" /> аудит архива
          </span>
          <span className="flex items-center gap-2">
            <Zap className="size-4 text-primary" /> автопочинка и сборка
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> публикация в один клик
          </span>
        </div>
      </header>

      <Dropzone onFile={handleFile} busy={busy} fileName={fileName} />

      {error && (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {phase === "analyzing" && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Анализируем архив и собираем статику…
        </p>
      )}

      {result && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="panel h-fit p-5">
            <h2 className="font-display text-lg font-semibold">Отчёт проверки</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.files.length} файлов · {formatBytes(result.totalSize)} к публикации
            </p>
            <div className="mt-3">
              <CheckList checks={result.checks} />
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <label className="block text-sm font-medium" htmlFor="project">
                Имя проекта (адрес: {projectName || "site"}.pages.dev)
              </label>
              <input
                id="project"
                value={projectName}
                onChange={(e) =>
                  setProjectName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40),
                  )
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <Button
                className="w-full"
                size="lg"
                disabled={busy || !projectName}
                onClick={handleDeploy}
              >
                {phase === "deploying" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                {phase === "deploying" ? "Публикуем…" : "Опубликовать на Cloudflare Pages"}
              </Button>
              {files && (
                <p className="text-xs text-muted-foreground">
                  В архиве: {Object.keys(files).length} файлов · тип: {result.analysis.framework}
                </p>
              )}
            </div>
          </section>

          <SitePreview
            baseHtml={result.baseHtml}
            patches={patches}
            setPatches={setPatches}
            navStub={navStub}
            setNavStub={setNavStub}
          />
        </div>
      )}

      {sites.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold">Мои сайты</h2>
          <div className="mt-4 space-y-3">
            {sites.map((s) => (
              <SiteCard
                key={s.projectName}
                site={s}
                onRemoved={removeSite}
                {...(result ? { onRedeploy: () => void handleDeploy() } : {})}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
