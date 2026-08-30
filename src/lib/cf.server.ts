const API = "https://api.cloudflare.com/client/v4";

export type UploadFile = { path: string; base64: string; contentType: string };

type CfEnv = { token: string; accountId: string };

export function cfEnv(): CfEnv {
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
  if (!token || !accountId) {
    throw new Error(
      "Не настроены доступы Cloudflare (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID).",
    );
  }
  return { token, accountId };
}

async function cfFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: {
    success?: boolean;
    result?: T;
    errors?: Array<{ code: number; message: string }>;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Cloudflare вернул неожиданный ответ (${res.status})`);
  }
  if (!json.success) {
    const err = json.errors?.[0];
    const e = new Error(err?.message ?? `Ошибка Cloudflare (${res.status})`) as Error & {
      code?: number;
    };
    e.code = err?.code;
    throw e;
  }
  return json.result as T;
}

export function sanitizeName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "site";
}

async function hashFile(base64: string, path: string) {
  const ext = path.includes(".") ? path.split(".").pop()! : "";
  const data = new TextEncoder().encode(base64 + ext);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export type DeployResult = {
  projectName: string;
  url: string;
  deploymentId: string;
  status: string;
};

export async function ensureProject(env: CfEnv, name: string) {
  try {
    await cfFetch(`${API}/accounts/${env.accountId}/pages/projects`, env.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, production_branch: "main" }),
    });
  } catch (e) {
    const code = (e as { code?: number }).code;
    // 8000009 / 8000007: project already exists — reuse it.
    if (code !== 8000009 && code !== 8000007 && !/already exists/i.test((e as Error).message)) {
      throw e;
    }
  }
}

export async function deployFiles(
  env: CfEnv,
  projectName: string,
  files: UploadFile[],
): Promise<DeployResult> {
  await ensureProject(env, projectName);

  const jwt = await cfFetch<{ jwt: string }>(
    `${API}/accounts/${env.accountId}/pages/projects/${projectName}/upload-token`,
    env.token,
  ).then((r) => r.jwt);

  const manifest: Record<string, string> = {};
  const payloads: Array<{
    key: string;
    value: string;
    metadata: { contentType: string };
    base64: true;
  }> = [];

  for (const f of files) {
    const hash = await hashFile(f.base64, f.path);
    manifest[`/${f.path.replace(/^\/+/, "")}`] = hash;
    payloads.push({
      key: hash,
      value: f.base64,
      metadata: { contentType: f.contentType },
      base64: true,
    });
  }

  const missing = await cfFetch<string[]>(`${API}/pages/assets/check-missing`, jwt, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hashes: payloads.map((p) => p.key) }),
  }).catch(() => payloads.map((p) => p.key));

  const missingSet = new Set(missing);
  const toUpload = payloads.filter((p) => missingSet.has(p.key));

  for (let i = 0; i < toUpload.length; i += 15) {
    const batch = toUpload.slice(i, i + 15);
    await cfFetch(`${API}/pages/assets/upload`, jwt, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
  }

  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  form.append("branch", "main");

  const deployment = await cfFetch<{
    id: string;
    url: string;
    latest_stage?: { name: string; status: string };
  }>(`${API}/accounts/${env.accountId}/pages/projects/${projectName}/deployments`, env.token, {
    method: "POST",
    body: form,
  });

  return {
    projectName,
    url: deployment.url ?? `https://${projectName}.pages.dev`,
    deploymentId: deployment.id,
    status: deployment.latest_stage?.status ?? "queued",
  };
}

export async function projectStatus(env: CfEnv, projectName: string) {
  const project = await cfFetch<{
    name: string;
    subdomain: string;
    latest_deployment?: {
      id: string;
      url: string;
      created_on: string;
      latest_stage?: { name: string; status: string };
    };
  }>(`${API}/accounts/${env.accountId}/pages/projects/${projectName}`, env.token);

  const dep = project.latest_deployment;
  return {
    projectName: project.name,
    url: dep?.url ?? `https://${project.subdomain}`,
    productionUrl: `https://${project.subdomain}`,
    stage: dep?.latest_stage?.name ?? "unknown",
    status: dep?.latest_stage?.status ?? "unknown",
    createdOn: dep?.created_on ?? null,
  };
}

export async function removeProject(env: CfEnv, projectName: string) {
  await cfFetch(`${API}/accounts/${env.accountId}/pages/projects/${projectName}`, env.token, {
    method: "DELETE",
  });
  return { ok: true };
}
