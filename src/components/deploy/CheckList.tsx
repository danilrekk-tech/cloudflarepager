import { Check, AlertTriangle, Wrench, XCircle } from "lucide-react";
import type { Check as CheckItem } from "@/lib/pipeline/analyze";

const META = {
  ok: { icon: Check, tone: "text-success", label: "OK" },
  fixed: { icon: Wrench, tone: "text-primary", label: "Исправлено" },
  warn: { icon: AlertTriangle, tone: "text-warning", label: "Внимание" },
  error: { icon: XCircle, tone: "text-destructive", label: "Ошибка" },
} as const;

export function CheckList({ checks }: { checks: CheckItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {checks.map((c) => {
        const meta = META[c.status];
        const Icon = meta.icon;
        return (
          <li key={c.id} className="flex gap-3 py-3">
            <Icon className={`mt-0.5 size-4 shrink-0 ${meta.tone}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {c.title}
                <span className={`ml-2 text-xs font-normal ${meta.tone}`}>{meta.label}</span>
              </p>
              <p className="mt-0.5 text-sm break-words text-muted-foreground">{c.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
