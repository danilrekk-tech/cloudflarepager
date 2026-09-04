import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Monitor,
  Smartphone,
  X,
  Search,
  Upload,
  Image as ImageIcon,
  Type,
  Link2,
  Save,
  RotateCcw,
  Trash2,
  Crosshair,
  PanelLeftClose,
  PanelLeftOpen,
  Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { composeHtml, withEditor } from "@/lib/pipeline/build";
import {
  EDITOR_SCRIPT,
  upsertPatch,
  patchKey,
  type Patch,
  type Slot,
} from "@/lib/pipeline/overrides";
import { usePatchSets } from "@/lib/patchsets";

type Msg = Slot & { source: string; type: string; items?: Slot[]; x?: number; y?: number };
export type Upload = { id: string; name: string; url: string; w: number; h: number };

export function EditorOverlay({
  baseHtml,
  patches,
  setPatches,
  navStub,
  setNavStub,
  uploads,
  setUploads,
  onClose,
}: {
  baseHtml: string;
  patches: Patch[];
  setPatches: (p: Patch[]) => void;
  navStub: boolean;
  setNavStub: (v: boolean) => void;
  uploads: Upload[];
  setUploads: (u: Upload[]) => void;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [sidebar, setSidebar] = useState(true);
  const [tab, setTab] = useState<"slots" | "patches" | "uploads" | "sets">("slots");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Slot | null>(null);
  const [value, setValue] = useState("");
  const [logoMode, setLogoMode] = useState<{ url: string; width: number } | null>(null);
  const [dropping, setDropping] = useState(false);
  const [sizeW, setSizeW] = useState("");
  const [sizeH, setSizeH] = useState("");
  const [fit, setFit] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { sets, saveSet, removeSet } = usePatchSets();

  const srcDoc = useMemo(
    () => withEditor(composeHtml(baseHtml, patches, navStub), EDITOR_SCRIPT),
    [baseHtml, patches, navStub],
  );

  const send = useCallback((msg: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ source: "pixelift-host", ...msg }, "*");
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as Msg | undefined;
      if (!d || d.source !== "pixelift-editor") return;
      if (d.type === "inventory" && d.items) {
        setSlots(d.items);
        return;
      }
      if (d.type === "logo-drop") {
        if (!logoMode) return;
        setPatches(
          upsertPatch(patches, {
            kind: "logo",
            selector: d.selector,
            value: logoMode.url,
            width: logoMode.width,
            x: d.x ?? 50,
            y: d.y ?? 50,
          }),
        );
        setLogoMode(null);
        toast.success("Логотип размещён");
        return;
      }
      if (d.type === "select") {
        const slot: Slot = {
          selector: d.selector,
          kind: d.kind,
          label: d.label,
          value: d.value,
          width: d.width,
          height: d.height,
          natural: d.natural,
          broken: d.broken,
        };
        setSelected(slot);
        const existing = patches.find((p) => p.selector === slot.selector && p.kind === slot.kind);
        setValue(existing && "value" in existing ? existing.value : slot.value);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [patches, setPatches, logoMode]);

  // Keep the size fields in sync with the currently selected element.
  useEffect(() => {
    if (!selected) {
      setSizeW("");
      setSizeH("");
      setFit("");
      return;
    }
    const s = patches.find((p) => p.kind === "size" && p.selector === selected.selector);
    setSizeW(s && s.kind === "size" ? (s.width ?? "") : "");
    setSizeH(s && s.kind === "size" ? (s.height ?? "") : "");
    setFit(s && s.kind === "size" ? (s.fit ?? "") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.selector, selected?.kind]);

  function norm(v: string) {
    const t = v.trim();
    if (!t) return "";
    return /^[0-9.]+$/.test(t) ? `${t}px` : t;
  }

  function applySize() {
    if (!selected) return;
    const w = norm(sizeW);
    const h = norm(sizeH);
    if (!w && !h && !fit) {
      resetSize();
      return;
    }
    setPatches(
      upsertPatch(patches, {
        kind: "size",
        selector: selected.selector,
        value: `${w}|${h}|${fit}`,
        ...(w ? { width: w } : {}),
        ...(h ? { height: h } : {}),
        ...(fit ? { fit } : {}),
      }),
    );
    toast.success("Размер применён");
  }

  function resetSize() {
    if (!selected) return;
    setSizeW("");
    setSizeH("");
    setFit("");
    setPatches(patches.filter((p) => !(p.kind === "size" && p.selector === selected.selector)));
  }

  function applyValue(next = value) {
    if (!selected) return;
    if (selected.kind === "link") {
      setPatches(upsertPatch(patches, { kind: "link", selector: selected.selector, value: next }));
    } else if (selected.kind === "image") {
      setPatches(upsertPatch(patches, { kind: "image", selector: selected.selector, value: next }));
    } else {
      setPatches(upsertPatch(patches, { kind: "text", selector: selected.selector, value: next }));
    }
    toast.success("Изменение применено");
  }

  async function onUpload(files: FileList | null, applyToSelected = false) {
    if (!files) return;
    const next: Upload[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("read"));
        r.readAsDataURL(file);
      });
      const dim = await new Promise<{ w: number; h: number }>((res) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res({ w: 0, h: 0 });
        img.src = url;
      });
      next.push({ id: `${Date.now()}-${file.name}`, name: file.name, url, ...dim });
    }
    setUploads([...next, ...uploads]);
    const first = next[0];
    if (applyToSelected && first && selected?.kind === "image") {
      setValue(first.url);
      applyValue(first.url);
      return;
    }
    if (next.length) toast.success(`Загружено изображений: ${next.length}`);
  }

  const filtered = slots.filter(
    (s) =>
      !query ||
      s.label.toLowerCase().includes(query.toLowerCase()) ||
      s.selector.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button size="sm" variant="ghost" onClick={() => setSidebar(!sidebar)}>
          {sidebar ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
        </Button>
        <span className="font-display text-sm font-semibold">Редактор сайта</span>
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
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Заглушки навигации
          <Switch checked={navStub} onCheckedChange={setNavStub} />
        </label>
        <span className="text-xs text-muted-foreground">Правок: {patches.length}</span>
        <Button size="sm" variant="ghost" onClick={() => send({ type: "inventory" })}>
          <RotateCcw className="size-4" />
          Пересканировать
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const name = window.prompt("Название набора правок", `Набор ${sets.length + 1}`);
            if (!name) return;
            saveSet(name, patches);
            toast.success("Набор сохранён");
          }}
        >
          <Save className="size-4" />
          Сохранить набор
        </Button>
        <Button size="sm" className="ml-auto" onClick={onClose}>
          <X className="size-4" />
          Готово
        </Button>
      </div>

      {logoMode && (
        <p className="border-b border-border bg-accent/15 px-4 py-2 text-xs text-accent">
          Кликните по месту на странице, куда поставить логотип ({logoMode.width}px). Esc — отмена.
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        {sidebar && (
          <aside className="flex w-[360px] shrink-0 flex-col border-r border-border bg-surface-2">
            <div className="flex gap-1 border-b border-border p-2 text-xs">
              {(
                [
                  ["slots", "Элементы"],
                  ["patches", "Правки"],
                  ["uploads", "Мои файлы"],
                  ["sets", "Наборы"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-md px-2 py-1.5 ${tab === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {tab === "slots" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
                    <Search className="size-4 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Поиск по элементам"
                      className="w-full bg-transparent py-2 text-sm outline-none"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Найдено: {filtered.length}</p>
                  {filtered.map((s) => (
                    <button
                      key={s.kind + s.selector}
                      onClick={() => {
                        setSelected(s);
                        setValue(s.value);
                        send({ type: "highlight", selector: s.selector });
                      }}
                      className={`flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left text-xs ${
                        selected?.selector === s.selector && selected.kind === s.kind
                          ? "border-accent bg-accent/10"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {s.kind === "image" ? (
                        <ImageIcon className="mt-0.5 size-3.5 text-accent" />
                      ) : s.kind === "link" ? (
                        <Link2 className="mt-0.5 size-3.5 text-primary" />
                      ) : (
                        <Type className="mt-0.5 size-3.5 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.label || s.selector}</span>
                        <span className="block truncate text-muted-foreground">
                          {s.width}×{s.height}px{s.broken ? " · картинка не загрузилась" : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {tab === "patches" && (
                <div className="space-y-2">
                  {patches.length === 0 && (
                    <p className="text-xs text-muted-foreground">Правок пока нет.</p>
                  )}
                  {patches.map((p) => (
                    <div
                      key={patchKey(p)}
                      className="flex items-start gap-2 rounded-md border border-border px-2 py-2 text-xs"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.kind}</span>
                        <span className="block truncate text-muted-foreground">{p.selector}</span>
                        <span className="block truncate">{p.value}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPatches(patches.filter((x) => patchKey(x) !== patchKey(p)))
                        }
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {patches.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setPatches([])}>
                      Сбросить все правки
                    </Button>
                  )}
                </div>
              )}

              {tab === "uploads" && (
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm hover:bg-muted">
                    <Upload className="size-4" />
                    Загрузить изображения
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => void onUpload(e.target.files)}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {uploads.map((u) => (
                      <div key={u.id} className="rounded-md border border-border p-2">
                        <img
                          src={u.url}
                          alt={u.name}
                          className="h-20 w-full rounded bg-background object-contain"
                        />
                        <p className="mt-1 truncate text-[11px]">{u.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {u.w}×{u.h}px
                        </p>
                        <div className="mt-1 flex gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-[11px]"
                            disabled={!selected || selected.kind !== "image"}
                            onClick={() => {
                              setValue(u.url);
                              applyValue(u.url);
                            }}
                          >
                            В слот
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              const w = Number(window.prompt("Ширина логотипа, px", "140"));
                              if (!w || Number.isNaN(w)) return;
                              setLogoMode({ url: u.url, width: w });
                              send({ type: "mode", mode: "logo" });
                              toast.info("Кликните по месту на странице");
                            }}
                          >
                            Логотип
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "sets" && (
                <div className="space-y-2">
                  {sets.length === 0 && (
                    <p className="text-xs text-muted-foreground">Сохранённых наборов нет.</p>
                  )}
                  {sets.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-border px-2 py-2 text-xs"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{s.patches.length} правок</span>
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => setPatches(s.patches)}>
                        Применить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeSet(s.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <div className="max-h-[46vh] space-y-3 overflow-y-auto border-t border-border p-3">
                <div className="flex items-center gap-2">
                  {selected.kind === "image" ? (
                    <ImageIcon className="size-4 text-accent" />
                  ) : selected.kind === "link" ? (
                    <Link2 className="size-4 text-primary" />
                  ) : (
                    <Type className="size-4 text-muted-foreground" />
                  )}
                  <span className="truncate text-sm font-medium">
                    {selected.label || selected.selector}
                  </span>
                </div>
                <p className="font-mono text-[11px] break-all text-muted-foreground">
                  {selected.selector}
                </p>

                {selected.kind === "image" && (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-accent/40 bg-accent/10 p-2 text-xs">
                      <p className="font-medium text-accent">
                        Загрузите картинку {Math.max(selected.width, 1) * 2}×
                        {Math.max(selected.height, 1) * 2}px
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        Место на странице {selected.width}×{selected.height}px, запас 2× для
                        Retina
                        {selected.natural
                          ? ` · сейчас ${selected.natural.w}×${selected.natural.h}px`
                          : ""}
                      </p>
                    </div>
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDropping(true);
                      }}
                      onDragLeave={() => setDropping(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDropping(false);
                        void onUpload(e.dataTransfer.files, true);
                      }}
                      className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-3 py-5 text-center text-xs transition ${
                        dropping
                          ? "border-accent bg-accent/15"
                          : "border-border hover:border-accent hover:bg-muted"
                      }`}
                    >
                      <Upload className="size-5 text-accent" />
                      <span className="font-medium">Перетащите файл сюда</span>
                      <span className="text-muted-foreground">
                        или нажмите, чтобы выбрать — картинка сразу встанет на место
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void onUpload(e.target.files, true)}
                      />
                    </label>
                    {uploads.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] text-muted-foreground">
                          Ранее загруженные:
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {uploads.slice(0, 12).map((u) => (
                            <button
                              key={u.id}
                              title={`${u.name} · ${u.w}×${u.h}px`}
                              onClick={() => {
                                setValue(u.url);
                                applyValue(u.url);
                              }}
                              className="size-14 shrink-0 overflow-hidden rounded border border-border hover:border-accent"
                            >
                              <img
                                src={u.url}
                                alt={u.name}
                                className="size-full bg-background object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selected.kind === "text" ? (
                  <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                ) : (
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={
                      selected.kind === "image" ? "URL изображения или data:…" : "https://ссылка"
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                )}

                <div className="space-y-2 rounded-lg border border-border p-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <Ruler className="size-3.5 text-primary" />
                    Размер элемента
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-[11px] text-muted-foreground">
                      Ширина
                      <input
                        value={sizeW}
                        onChange={(e) => setSizeW(e.target.value)}
                        placeholder={`${selected.width}px`}
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                      />
                    </label>
                    <label className="flex-1 text-[11px] text-muted-foreground">
                      Высота
                      <input
                        value={sizeH}
                        onChange={(e) => setSizeH(e.target.value)}
                        placeholder={`${selected.height}px`}
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {["50%", "75%", "100%", "auto"].map((v) => (
                      <Button
                        key={v}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setSizeW(v)}
                      >
                        Ш {v}
                      </Button>
                    ))}
                  </div>
                  {selected.kind === "image" && (
                    <div className="flex gap-1">
                      {(["cover", "contain"] as const).map((f) => (
                        <Button
                          key={f}
                          size="sm"
                          variant={fit === f ? "secondary" : "outline"}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setFit(fit === f ? "" : f)}
                        >
                          {f === "cover" ? "Заполнить" : "Вписать"}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={applySize}>
                      Применить размер
                    </Button>
                    <Button size="sm" variant="ghost" onClick={resetSize}>
                      Сбросить
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => applyValue()}>
                    Применить
                  </Button>
                  {selected.kind !== "link" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const href = window.prompt("Куда ведёт клик по элементу?", "#");
                        if (href === null) return;
                        setPatches(
                          upsertPatch(patches, {
                            kind: "link",
                            selector: selected.selector,
                            value: href,
                          }),
                        );
                        toast.success("Элемент стал кликабельным");
                      }}
                    >
                      <Crosshair className="size-4" />
                      Сделать кликабельным
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                    Снять выбор
                  </Button>
                </div>
              </div>
            )}
          </aside>
        )}

        <div className="min-w-0 flex-1 overflow-auto bg-surface-2 p-3">
          <iframe
            ref={frameRef}
            title="Редактор сайта"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="mx-auto h-full min-h-[600px] rounded-xl border border-border bg-background"
            style={{ width: device === "mobile" ? 390 : "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
