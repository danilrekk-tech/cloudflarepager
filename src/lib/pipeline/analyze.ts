import type { FileMap } from "./zip";

export type CheckStatus = "ok" | "fixed" | "warn" | "error";

export type Check = {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
};

export type Strategy = "static" | "bundle";

export type Analysis = {
  strategy: Strategy;
  htmlEntry: string | null;
  jsEntry: string | null;
  cssFiles: string[];
  usesTailwind: boolean;
  framework: string;
  checks: Check[];
};

const HTML = /\.html?$/i;
const CODE = /\.(tsx|jsx|ts|js|mjs)$/i;

function pickHtml(files: FileMap): string | null {
  const htmls = Object.keys(files).filter((p) => HTML.test(p));
  if (!htmls.length) return null;
  const score = (p: string) => {
    const depth = p.split("/").length;
    const base = p.split("/").pop()!.toLowerCase();
    let s = files[p]!.bytes.length;
    if (base === "index.html") s *= 4;
    if (base === "preview.html") s *= 2;
    s /= depth;
    return s;
  };
  return htmls.sort((a, b) => score(b) - score(a))[0]!;
}

function pickJsEntry(files: FileMap): string | null {
  const prefer = [
    "src/main.tsx",
    "src/main.jsx",
    "src/index.tsx",
    "src/index.jsx",
    "main.tsx",
    "index.tsx",
    "main.jsx",
    "index.jsx",
    "src/App.tsx",
    "App.tsx",
    "src/app.tsx",
  ];
  for (const p of prefer) if (files[p]) return p;
  const any = Object.keys(files).filter((p) => CODE.test(p) && !p.includes("config"));
  return any.sort((a, b) => a.split("/").length - b.split("/").length)[0] ?? null;
}

function detectFramework(files: FileMap): string {
  const pkgRaw = files["package.json"]?.text;
  let deps = "";
  try {
    const pkg = pkgRaw ? JSON.parse(pkgRaw) : {};
    deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");
  } catch {
    /* ignore malformed package.json */
  }
  if (/\bnext\b/.test(deps) || files["next.config.mjs"] || files["next.config.js"])
    return "Next.js";
  if (/\bvite\b/.test(deps) || files["vite.config.ts"] || files["vite.config.js"]) return "Vite";
  if (deps.includes("react")) return "React";
  if (Object.keys(files).some((p) => /\.(tsx|jsx)$/i.test(p))) return "React (без манифеста)";
  return "Статический HTML";
}

export function analyze(files: FileMap): Analysis {
  const checks: Check[] = [];
  const framework = detectFramework(files);
  const htmlEntry = pickHtml(files);
  const codeFiles = Object.keys(files).filter((p) => CODE.test(p));
  const cssFiles = Object.keys(files).filter((p) => p.endsWith(".css"));

  const htmlIsShell =
    !!htmlEntry &&
    (files[htmlEntry]!.text ?? "").length < 6000 &&
    /<script[^>]+src=["'][^"']*\.(tsx|jsx|ts|js)["']/i.test(files[htmlEntry]!.text ?? "");

  const strategy: Strategy = htmlEntry && !htmlIsShell ? "static" : "bundle";
  const jsEntry = strategy === "bundle" ? pickJsEntry(files) : null;

  checks.push({
    id: "framework",
    title: "Тип проекта",
    status: "ok",
    detail: `${framework} · ${Object.keys(files).length} файлов`,
  });

  if (strategy === "static") {
    checks.push({
      id: "entry",
      title: "Точка входа",
      status: htmlEntry === "index.html" ? "ok" : "fixed",
      detail:
        htmlEntry === "index.html"
          ? "index.html найден в корне"
          : `Найден ${htmlEntry}, будет переименован в index.html`,
    });
  } else {
    checks.push({
      id: "entry",
      title: "Точка входа",
      status: jsEntry ? "fixed" : "error",
      detail: jsEntry
        ? `HTML-обёртки нет — соберу ${jsEntry} в статический index.html`
        : "Не найден ни HTML, ни исходники React",
    });
  }

  const hasBuildOutput = Object.keys(files).some((p) => /^(dist|build|out)\//.test(p));
  checks.push({
    id: "build",
    title: "Сборка",
    status: hasBuildOutput ? "ok" : strategy === "bundle" ? "fixed" : "ok",
    detail: hasBuildOutput
      ? "В архиве уже есть собранная версия"
      : strategy === "bundle"
        ? `Собираю ${codeFiles.length} модулей в браузере (esbuild) — Cloudflare Pages получит готовую статику`
        : "Сборка не требуется, это статический сайт",
  });

  const allText = Object.values(files)
    .filter((f) => f.isText)
    .map((f) => f.text ?? "")
    .join("\n");
  const usesTailwind =
    /class(Name)?=["'][^"']*\b(flex|grid|px-\d|py-\d|text-(xs|sm|lg|xl)|bg-\w+-\d{2,3})\b/.test(
      allText,
    );
  const hasTailwindBuilt =
    /tailwindcss|--tw-|cdn\.tailwindcss\.com/.test(allText) &&
    (cssFiles.some((p) => (files[p]!.text ?? "").length > 5000) ||
      /cdn\.tailwindcss\.com/.test(allText));

  if (usesTailwind) {
    checks.push({
      id: "tailwind",
      title: "Tailwind CSS",
      status: hasTailwindBuilt ? "ok" : "fixed",
      detail: hasTailwindBuilt
        ? "Стили уже подключены"
        : "Классы Tailwind есть, но собранного CSS нет — подключу Tailwind runtime",
    });
  }

  checks.push({
    id: "deps",
    title: "Зависимости",
    status: files["package.json"] ? "fixed" : "ok",
    detail: files["package.json"]
      ? "node_modules в архиве нет — импорты пакетов переведу на CDN (esm.sh)"
      : "Внешние зависимости не требуются",
  });

  checks.push({
    id: "spa",
    title: "Маршрутизация SPA",
    status: files["_redirects"] ? "ok" : "fixed",
    detail: files["_redirects"]
      ? "_redirects уже есть"
      : "Добавлю _redirects (fallback на index.html) и 404.html",
  });

  checks.push({
    id: "headers",
    title: "Заголовки и robots",
    status: "fixed",
    detail: "Добавлю _headers с политикой кеширования и robots.txt",
  });

  return { strategy, htmlEntry, jsEntry, cssFiles, usesTailwind, framework, checks };
}
