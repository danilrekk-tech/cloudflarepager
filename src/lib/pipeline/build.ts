import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import type { FileMap } from "./zip";
import { analyze, type Analysis, type Check } from "./analyze";
import { runtimeScript, type Patch } from "./overrides";

export type OutFile = { path: string; bytes: Uint8Array; contentType: string };

export type BuildResult = {
  analysis: Analysis;
  checks: Check[];
  html: string;
  baseHtml: string;
  files: OutFile[];
  totalSize: number;
};

const REACT_VERSION = "19.2.0";
const IMPORT_MAP = {
  imports: {
    react: `https://esm.sh/react@${REACT_VERSION}`,
    "react/": `https://esm.sh/react@${REACT_VERSION}/`,
    "react-dom": `https://esm.sh/react-dom@${REACT_VERSION}?external=react`,
    "react-dom/": `https://esm.sh/react-dom@${REACT_VERSION}&external=react/`,
    "react-dom/client": `https://esm.sh/react-dom@${REACT_VERSION}/client?external=react`,
    "react/jsx-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
  },
};

const MIME: Record<string, string> = {
  html: "text/html",
  css: "text/css",
  js: "application/javascript",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain",
  xml: "application/xml",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
};

function mime(path: string) {
  return MIME[path.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
}

const enc = new TextEncoder();
function textFile(path: string, text: string): OutFile {
  return { path, bytes: enc.encode(text), contentType: mime(path) };
}

let ready: Promise<void> | null = null;
function initEsbuild() {
  if (!ready) ready = esbuild.initialize({ wasmURL, worker: true });
  return ready;
}

const LOADERS: Record<string, esbuild.Loader> = {
  tsx: "tsx",
  ts: "ts",
  jsx: "jsx",
  js: "jsx",
  mjs: "jsx",
  json: "json",
  css: "empty",
  svg: "dataurl",
  png: "dataurl",
  jpg: "dataurl",
  jpeg: "dataurl",
  gif: "dataurl",
  webp: "dataurl",
};

function resolveLocal(files: FileMap, importer: string, spec: string): string | null {
  const base = importer.includes("/") ? importer.slice(0, importer.lastIndexOf("/")) : "";
  const joined = spec.startsWith("/")
    ? spec.slice(1)
    : [...base.split("/").filter(Boolean), ...spec.split("/")].reduce<string[]>((acc, seg) => {
        if (seg === "." || seg === "") return acc;
        if (seg === "..") {
          acc.pop();
          return acc;
        }
        acc.push(seg);
        return acc;
      }, []);
  const p = Array.isArray(joined) ? joined.join("/") : joined;
  const candidates = [
    p,
    `${p}.tsx`,
    `${p}.ts`,
    `${p}.jsx`,
    `${p}.js`,
    `${p}.mjs`,
    `${p}/index.tsx`,
    `${p}/index.ts`,
    `${p}/index.jsx`,
    `${p}/index.js`,
  ];
  for (const c of candidates) if (files[c]) return c;
  return null;
}

function cdnUrl(spec: string) {
  return `https://esm.sh/${spec}?external=react,react-dom`;
}

async function bundle(files: FileMap, entry: string, log: string[]) {
  await initEsbuild();
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2020",
    minify: true,
    jsx: "automatic",
    jsxImportSource: "react",
    define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
    loader: { ".css": "empty" },
    plugins: [
      {
        name: "vfs",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (/^(https?:)?\/\//.test(args.path)) return { path: args.path, external: true };
            if (args.kind === "entry-point") return { path: args.path, namespace: "vfs" };
            if (args.path.startsWith(".") || args.path.startsWith("/")) {
              const hit = resolveLocal(files, args.importer, args.path);
              if (hit) return { path: hit, namespace: "vfs" };
              log.push(`Не найден локальный модуль ${args.path} (из ${args.importer}) — пропущен`);
              return { path: args.path, external: true };
            }
            if (args.path.startsWith("@/") || args.path.startsWith("~/")) {
              const hit =
                resolveLocal(files, "src/x", `./${args.path.slice(2)}`) ??
                resolveLocal(files, "x", `./${args.path.slice(2)}`);
              if (hit) return { path: hit, namespace: "vfs" };
            }
            if (args.path === "react" || args.path.startsWith("react/") || args.path === "react-dom" || args.path.startsWith("react-dom/"))
              return { path: args.path, external: true };
            return { path: cdnUrl(args.path), external: true };
          });
          b.onLoad({ filter: /.*/, namespace: "vfs" }, (args) => {
            const file = files[args.path];
            if (!file) return { contents: "", loader: "js" };
            const ext = args.path.split(".").pop()!.toLowerCase();
            const loader = LOADERS[ext] ?? "text";
            if (loader === "dataurl") return { contents: file.bytes, loader };
            return { contents: file.text ?? "", loader };
          });
        },
      },
    ],
  });
  for (const w of result.warnings) log.push(w.text);
  return result.outputFiles?.[0]?.text ?? "";
}

function ensureMount(files: FileMap, entry: string): { entry: string; files: FileMap } {
  const src = files[entry]?.text ?? "";
  if (/createRoot|ReactDOM\.render|hydrateRoot/.test(src)) return { entry, files };
  const virtual = "__pixelift_entry.tsx";
  const rel = `./${entry.replace(/\.(tsx|ts|jsx|js)$/, "")}`;
  const next: FileMap = {
    ...files,
    [virtual]: {
      path: virtual,
      isText: true,
      bytes: new Uint8Array(),
      text: `import { createRoot } from "react-dom/client";
import App from "${rel}";
const el = document.getElementById("root") ?? document.body.appendChild(Object.assign(document.createElement("div"), { id: "root" }));
createRoot(el).render(<App />);`,
    },
  };
  return { entry: virtual, files: next };
}

function injectHead(html: string, snippet: string) {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${snippet}\n</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => `${m}\n${snippet}`);
  return `${snippet}\n${html}`;
}

function injectBodyEnd(html: string, snippet: string) {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${snippet}\n</body>`);
  return `${html}\n${snippet}`;
}

function normalizeHtml(html: string, title: string, checks: Check[]) {
  let out = html;
  if (!/<!doctype/i.test(out)) {
    out = `<!doctype html>\n${out}`;
    checks.push({ id: "doctype", title: "DOCTYPE", status: "fixed", detail: "Добавлен <!doctype html>" });
  }
  if (!/<html[^>]*\slang=/i.test(out)) {
    out = out.replace(/<html/i, '<html lang="ru"');
  }
  if (!/<meta[^>]+charset/i.test(out)) {
    out = injectHead(out, '<meta charset="utf-8" />');
    checks.push({ id: "charset", title: "Кодировка", status: "fixed", detail: "Добавлен meta charset=utf-8" });
  }
  if (!/name=["']viewport["']/i.test(out)) {
    out = injectHead(out, '<meta name="viewport" content="width=device-width, initial-scale=1" />');
    checks.push({
      id: "viewport",
      title: "Мобильная вёрстка",
      status: "fixed",
      detail: "Добавлен meta viewport",
    });
  }
  if (!/<title>/i.test(out)) {
    out = injectHead(out, `<title>${title}</title>`);
    checks.push({ id: "title", title: "SEO", status: "fixed", detail: `Добавлен <title>${title}</title>` });
  }
  if (!/name=["']description["']/i.test(out)) {
    out = injectHead(
      out,
      `<meta name="description" content="${title} — сайт опубликован через Pixelift Deploy." />`,
    );
  }
  // Local dev-only script tags (vite entry) can't work on static hosting.
  const before = out;
  out = out.replace(/<script[^>]+src=["'][^"']*\.(tsx|ts|jsx)["'][^>]*>\s*<\/script>/gi, "");
  if (before !== out) {
    checks.push({
      id: "devscript",
      title: "Dev-скрипты",
      status: "fixed",
      detail: "Удалены ссылки на несобранные исходники (.tsx/.ts), заменены собранным бандлом",
    });
  }
  return out;
}

const STATIC_SKIP =
  /(^|\/)(package(-lock)?\.json|bun\.lock|tsconfig.*\.json|vite\.config\.\w+|next\.config\.\w+|postcss\.config\.\w+|tailwind\.config\.\w+|next-env\.d\.ts|\.gitignore|AGENTS\.md|ARCHITECTURE\.md|README\.md)$/i;
const SOURCE_EXT = /\.(tsx|ts|jsx|mts|cts)$/i;

export async function buildSite(
  files: FileMap,
  opts: { title: string; patches: Patch[]; navStub: boolean },
): Promise<BuildResult> {
  const analysis = analyze(files);
  const checks = [...analysis.checks];
  const log: string[] = [];
  const out: OutFile[] = [];

  let html: string;

  if (analysis.strategy === "static" && analysis.htmlEntry) {
    html = files[analysis.htmlEntry]!.text ?? "";
    for (const f of Object.values(files)) {
      if (f.path === analysis.htmlEntry) continue;
      if (SOURCE_EXT.test(f.path) || STATIC_SKIP.test(f.path)) continue;
      if (/\.html?$/i.test(f.path)) continue;
      out.push({ path: f.path, bytes: f.bytes, contentType: mime(f.path) });
    }
  } else if (analysis.jsEntry) {
    const prepared = ensureMount(files, analysis.jsEntry);
    let js = "";
    try {
      js = await bundle(prepared.files, prepared.entry, log);
      checks.push({
        id: "bundle",
        title: "Сборка бандла",
        status: "fixed",
        detail: `Собран JS-бандл (${Math.round(js.length / 1024)} KB), зависимости подтянуты с esm.sh`,
      });
    } catch (e) {
      checks.push({
        id: "bundle",
        title: "Сборка бандла",
        status: "error",
        detail: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
    const css = analysis.cssFiles
      .map((p) => files[p]!.text ?? "")
      .join("\n")
      // Tailwind source directives are meaningless in a static bundle (the CDN runtime handles them)
      .replace(/^\s*@tailwind[^;]*;\s*$/gm, "")
      .replace(/@apply[^;]*;/g, "");
    html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.title}</title>
${analysis.usesTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ""}
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="importmap">${JSON.stringify(IMPORT_MAP)}</script>
<script type="module">${js}</script>
</body>
</html>`;
    for (const f of Object.values(files)) {
      if (SOURCE_EXT.test(f.path) || STATIC_SKIP.test(f.path) || f.isText) continue;
      out.push({ path: f.path, bytes: f.bytes, contentType: mime(f.path) });
    }
  } else {
    throw new Error("В архиве не найдено ни HTML-страницы, ни исходников для сборки");
  }

  html = normalizeHtml(html, opts.title, checks);

  if (analysis.usesTailwind && !/cdn\.tailwindcss\.com|--tw-|tailwind/i.test(html)) {
    html = injectHead(html, '<script src="https://cdn.tailwindcss.com"></script>');
  }

  const baseHtml = html;
  html = composeHtml(baseHtml, opts.patches, opts.navStub);

  out.unshift(textFile("index.html", html));
  out.push(textFile("404.html", html));

  out.push(textFile("_redirects", "/*  /index.html  200\n"));
  out.push(
    textFile(
      "_headers",
      `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
    ),
  );
  if (!files["robots.txt"]) out.push(textFile("robots.txt", "User-agent: *\nAllow: /\n"));

  if (log.length) {
    checks.push({
      id: "log",
      title: "Предупреждения сборки",
      status: "warn",
      detail: log.slice(0, 5).join("; "),
    });
  }

  return {
    analysis,
    checks,
    html,
    baseHtml,
    files: out,
    totalSize: out.reduce((n, f) => n + f.bytes.length, 0),
  };
}

export function composeHtml(baseHtml: string, patches: Patch[], navStub: boolean) {
  return injectBodyEnd(baseHtml, `<script>${runtimeScript(patches, navStub)}</script>`);
}

export function withEditor(html: string, editorScript: string) {
  return injectBodyEnd(html, `<script>${editorScript}</script>`);
}

export function makeTextFile(path: string, text: string) {
  return textFile(path, text);
}

