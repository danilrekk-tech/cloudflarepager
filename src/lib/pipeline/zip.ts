import { unzipSync, strFromU8 } from "fflate";

export type SiteFile = {
  path: string;
  text?: string;
  bytes: Uint8Array;
  isText: boolean;
};

export type FileMap = Record<string, SiteFile>;

const TEXT_EXT =
  /\.(html?|css|js|mjs|cjs|jsx|ts|tsx|json|txt|md|svg|xml|csv|yml|yaml|toml|env|gitignore)$/i;

function normalize(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
}

function stripCommonRoot(paths: string[]) {
  const tops = new Set(paths.map((p) => p.split("/")[0]));
  if (tops.size !== 1) return null;
  const top = [...tops][0]!;
  if (paths.some((p) => p === top)) return null;
  return top;
}

export function readZip(buffer: ArrayBuffer): FileMap {
  const raw = unzipSync(new Uint8Array(buffer));
  const entries = Object.entries(raw)
    .map(([p, bytes]) => [normalize(p), bytes] as const)
    .filter(
      ([p, bytes]) =>
        p &&
        !p.endsWith("/") &&
        bytes.length > 0 &&
        !p.includes("__MACOSX") &&
        !p.split("/").some((seg) => seg === ".git" || seg === "node_modules") &&
        !p.endsWith(".DS_Store"),
    );

  if (!entries.length) throw new Error("Архив пуст или повреждён");

  const root = stripCommonRoot(entries.map(([p]) => p));
  const map: FileMap = {};
  for (const [p, bytes] of entries) {
    const path = root ? p.slice(root.length + 1) : p;
    if (!path) continue;
    const isText = TEXT_EXT.test(path);
    map[path] = {
      path,
      bytes,
      isText,
      ...(isText ? { text: strFromU8(bytes) } : {}),
    };
  }
  return map;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
