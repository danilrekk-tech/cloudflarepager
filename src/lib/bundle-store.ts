/**
 * Persists built site bundles in IndexedDB so a published site can be
 * re-opened in the editor later and re-deployed with new changes.
 */
import type { BuildResult } from "@/lib/pipeline/build";
import type { Patch } from "@/lib/pipeline/overrides";

export type StoredBundle = {
  projectName: string;
  title: string;
  result: BuildResult;
  patches: Patch[];
  navStub: boolean;
  url: string;
  siteId?: string;
  feedbackToken?: string;
  updatedAt: string;
};

const DB = "pixelift";
const STORE = "bundles";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "projectName" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function saveBundle(b: StoredBundle) {
  try {
    await tx("readwrite", (s) => s.put(b) as IDBRequest<IDBValidKey>);
  } catch {
    /* storage unavailable */
  }
}

export async function loadBundle(projectName: string): Promise<StoredBundle | null> {
  try {
    return (await tx<StoredBundle | undefined>("readonly", (s) => s.get(projectName))) ?? null;
  } catch {
    return null;
  }
}

export async function listBundleNames(): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
    return keys.map(String);
  } catch {
    return [];
  }
}

export async function deleteBundle(projectName: string) {
  try {
    await tx("readwrite", (s) => s.delete(projectName) as unknown as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}
