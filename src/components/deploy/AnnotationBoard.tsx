import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MousePointer2, PenLine, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAnnotations, addAnnotation, deleteAnnotation } from "@/lib/db.functions";

type Mark = {
  id: string;
  type: string;
  data: { x: number; y: number; x2?: number; y2?: number; text?: string };
};

/** Draw callouts and arrows over a live screenshot (iframe) of the deployed site. */
export function AnnotationBoard({ siteId, url }: { siteId: string; url: string }) {
  const fetchMarks = useServerFn(listAnnotations);
  const create = useServerFn(addAnnotation);
  const drop = useServerFn(deleteAnnotation);

  const boxRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setMarks((await fetchMarks({ data: { siteId } })) as unknown as Mark[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить пометки");
    }
  }, [fetchMarks, siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  function rel(e: React.MouseEvent) {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  async function save(type: "note" | "arrow", data: Mark["data"]) {
    try {
      const row = (await create({ data: { siteId, type, data } })) as unknown as Mark;
      setMarks((prev) => [...prev, row]);
      toast.success("Пометка сохранена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить пометку");
    }
  }

  async function remove(id: string) {
    try {
      await drop({ data: { id } });
      setMarks((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить пометку");
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="font-display text-sm font-semibold">Пометки поверх сайта</span>
        <Button size="sm" variant={drawing ? "default" : "outline"} onClick={() => setDrawing(!drawing)}>
          {drawing ? <PenLine className="size-4" /> : <MousePointer2 className="size-4" />}
          {drawing ? "Рисую: клик — выноска, протяжка — стрелка" : "Включить рисование"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          <RefreshCw className="size-4" />
        </Button>
        <Button size="sm" variant="secondary" asChild className="ml-auto">
          <a href={`${url}#pxann=1`} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Открыть с пометками
          </a>
        </Button>
      </div>

      <div
        ref={boxRef}
        className="relative h-[520px] w-full bg-surface-2"
        onMouseDown={(e) => {
          if (!drawing) return;
          setStart(rel(e));
        }}
        onMouseMove={(e) => {
          if (!drawing || !start) return;
          setCursor(rel(e));
        }}
        onMouseUp={(e) => {
          if (!drawing || !start) return;
          const end = rel(e);
          const far = Math.hypot(end.x - start.x, end.y - start.y) > 0.03;
          const text = window.prompt(far ? "Текст рядом со стрелкой" : "Текст выноски") ?? "";
          if (far) void save("arrow", { x: start.x, y: start.y, x2: end.x, y2: end.y, text });
          else if (text) void save("note", { x: start.x, y: start.y, text });
          setStart(null);
          setCursor(null);
        }}
      >
        <iframe
          title="Скриншот сайта"
          src={url}
          className="h-full w-full border-0 bg-background"
          sandbox="allow-scripts allow-same-origin"
        />
        <svg
          className={`absolute inset-0 size-full ${drawing ? "" : "pointer-events-none"}`}
          style={drawing ? { cursor: "crosshair" } : undefined}
        >
          {marks
            .filter((m) => m.type === "arrow")
            .map((m) => (
              <g key={m.id}>
                <line
                  x1={`${m.data.x * 100}%`}
                  y1={`${m.data.y * 100}%`}
                  x2={`${(m.data.x2 ?? m.data.x) * 100}%`}
                  y2={`${(m.data.y2 ?? m.data.y) * 100}%`}
                  stroke="#ef4444"
                  strokeWidth={3}
                />
                <circle
                  cx={`${(m.data.x2 ?? m.data.x) * 100}%`}
                  cy={`${(m.data.y2 ?? m.data.y) * 100}%`}
                  r={6}
                  fill="#ef4444"
                />
              </g>
            ))}
          {start && cursor && (
            <line
              x1={`${start.x * 100}%`}
              y1={`${start.y * 100}%`}
              x2={`${cursor.x * 100}%`}
              y2={`${cursor.y * 100}%`}
              stroke="#f59e0b"
              strokeWidth={3}
            />
          )}
        </svg>
        {marks
          .filter((m) => m.data.text)
          .map((m) => (
            <button
              key={m.id}
              type="button"
              title="Удалить пометку"
              onClick={() => void remove(m.id)}
              className="absolute z-10 max-w-[240px] -translate-x-1/2 -translate-y-full rounded-lg bg-destructive px-2 py-1 text-left text-xs font-semibold text-destructive-foreground shadow-lg"
              style={{ left: `${m.data.x * 100}%`, top: `${m.data.y * 100}%` }}
            >
              {m.data.text}
              <Trash2 className="ml-1 inline size-3" />
            </button>
          ))}
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground">
        Клик по выноске удаляет её. Пометки видны на сайте по ссылке «Открыть с пометками».
      </p>
    </div>
  );
}
