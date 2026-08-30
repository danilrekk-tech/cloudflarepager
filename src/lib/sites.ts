import { useCallback, useEffect, useState } from "react";

export type StoredSite = {
  projectName: string;
  url: string;
  createdAt: string;
  title: string;
};

const KEY = "pixelift.sites.v1";

function read(): StoredSite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSite[]) : [];
  } catch {
    return [];
  }
}

export function useSites() {
  const [sites, setSites] = useState<StoredSite[]>([]);

  useEffect(() => {
    setSites(read());
  }, []);

  const persist = useCallback((next: StoredSite[]) => {
    setSites(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const addSite = useCallback(
    (site: StoredSite) => persist([site, ...read().filter((s) => s.projectName !== site.projectName)]),
    [persist],
  );

  const removeSite = useCallback(
    (projectName: string) => persist(read().filter((s) => s.projectName !== projectName)),
    [persist],
  );

  return { sites, addSite, removeSite };
}

export function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
