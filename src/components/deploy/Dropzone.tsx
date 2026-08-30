import { useRef, useState } from "react";
import { UploadCloud, FileArchive } from "lucide-react";

export function Dropzone({
  onFile,
  busy,
  fileName,
}: {
  onFile: (file: File) => void;
  busy: boolean;
  fileName?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      onClick={() => !busy && inputRef.current?.click()}
      className={`grid-lines relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center transition-colors ${
        over ? "border-primary bg-primary/5" : "border-border bg-surface/60 hover:border-primary/60"
      } ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        {fileName ? <FileArchive className="size-7" /> : <UploadCloud className="size-7" />}
      </div>
      <div>
        <p className="font-display text-lg font-semibold">
          {fileName ?? "Перетащите ZIP-архив сайта"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          HTML-страницы, React/Vite/Next исходники — разберём, починим и опубликуем
        </p>
      </div>
    </div>
  );
}
