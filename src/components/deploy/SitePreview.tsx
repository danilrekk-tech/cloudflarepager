import { useEffect, useMemo, useRef, useState } from "react";
import { Monitor, Smartphone, MousePointerClick, RotateCcw, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { composeHtml, withEditor } from "@/lib/pipeline/build";
import { EDITOR_SCRIPT, type Patch } from "@/lib/pipeline/overrides";

type EditorMessage = { source: string; selector: string; kind: "text" | "image"; value: string };

export function SitePreview({
  baseHtml,
  patches,
  setPatches,
  navStub,
  setNavStub,
}: {
  baseHtml: string;
  patches: Patch[];
  setPatches: (p: Patch[]) => void;
  navStub: boolean;
  setNavStub: (v: boolean) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [draft, setDraft] = useState<EditorMessage | null>(null);
  const [value, setValue] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => {
    const html = composeHtml(baseHtml, patches, navStub && !edit);
    return edit ? withEditor(html, EDITOR_SCRIPT) : html;
  }, [baseHtml, patches, navStub, edit]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as EditorMessage | undefined;
      if (!data || data.source !== "pixelift-editor") return;
      setDraft(data);
      setValue(data.value ?? "");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function savePatch() {
    if (!draft) return;
    const next = patches.filter((p) => !(p.selector === draft.selector && p.kind === draft.kind));
    setPatches([...next, { selector: draft.selector, kind: draft.kind, value }]);
    setDraft(null);
  }

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
        <Button
          size="sm"
          variant={edit ? "default" : "outline"}
          onClick={() => {
            setEdit(!edit);
            setDraft(null);
          }}
        >
          <MousePointerClick className="size-4" />
          {edit ? "Режим правки включён" : "Править текст и картинки"}
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

      {edit && (
        <p className="border-b border-border bg-primary/10 px-4 py-2 text-xs text-primary">
          Кликните по тексту или изображению на странице, чтобы изменить его.
        </p>
      )}

      {draft && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-4 py-3">
          <span className="font-mono text-xs text-muted-foreground">
            {draft.kind === "image" ? "URL изображения" : "Текст"} · {draft.selector}
          </span>
          <input
            className="min-w-64 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={draft.kind === "image" ? "https://..." : "Новый текст"}
          />
          <Button size="sm" onClick={savePatch}>
            Применить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
            Отмена
          </Button>
        </div>
      )}

      <div className="flex justify-center bg-surface-2 p-4">
        <iframe
          ref={frameRef}
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
