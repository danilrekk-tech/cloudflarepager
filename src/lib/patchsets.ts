import { useCallback, useEffect, useState } from "react";
import type { Patch, PatchSet } from "@/lib/pipeline/overrides";

const KEY = "pixelift.patchsets.v1";

function read(): PatchSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PatchSet[]) : [];
  } catch {
    return [];
  }
}

export function usePatchSets() {
  const [sets, setSets] = useState<PatchSet[]>([]);

  useEffect(() => {
    setSets(read());
  }, []);

  const persist = useCallback((next: PatchSet[]) => {
    setSets(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const saveSet = useCallback(
    (name: string, patches: Patch[]) => {
      const set: PatchSet = {
        id: `${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
        patches,
      };
      persist([set, ...read()].slice(0, 30));
      return set;
    },
    [persist],
  );

  const removeSet = useCallback(
    (id: string) => persist(read().filter((s) => s.id !== id)),
    [persist],
  );

  return { sets, saveSet, removeSet };
}
