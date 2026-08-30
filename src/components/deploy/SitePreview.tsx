import { useMemo, useState } from "react";
import { Monitor, Smartphone, Maximize2, RotateCcw, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { composeHtml } from "@/lib/pipeline/build";
import type { Patch } from "@/lib/pipeline/overrides";

export function SitePreview({
  baseHtml,
  patches,
  setPatches,
  navStub,
  setNavStub,
  onOpenEditor,
}: {
  baseHtml: string;
  patches: Patch[];
  setPatches: (p: Patch[]) => void;
  navStub: boolean;
  setNavStub: (v: boolean) => void;
  onOpenEditor: () => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const srcDoc = useMemo(
    () => composeHtml(baseHtml, patches, navStub),
    [baseHtml, patches, navStub],
  );

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className="font-display text-sm font-semibold">Предпросмотр</span>
        <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
          <Button
            size="sm"
            variant={device === "desktop" ? "secondary" : "ghost"}
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="size-4" />
          </Button>
          <Button
            size="sm"
            variant={device === "mobile" ? "secondary" : "ghost"}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="size-4" />
          </Button>
        </div>
        <Button size="sm" onClick={onOpenEditor}>
          <Maximize2 className="size-4" />
          Открыть редактор на весь экран
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Link2Off className="size-4" />
          Заглушки для навигации
          <Switch checked={navStub} onCheckedChange={setNavStub} />
        </label>
        {patches.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setPatches([])}>
            <RotateCcw className="size-4" />
            Сбросить {patches.length}
          </Button>
        )}
      </div>

      <div className="flex justify-center bg-surface-2 p-4">
        <iframe
          title="Предпросмотр сайта"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin allow-forms"
          className="h-[620px] rounded-xl border border-border bg-background transition-all"
          style={{ width: device === "mobile" ? 390 : "100%" }}
        />
      </div>
    </div>
  );
}
