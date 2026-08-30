import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const fileSchema = z.object({
  path: z.string().min(1),
  base64: z.string(),
  contentType: z.string(),
});

export const deploySite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ projectName: z.string().min(1), files: z.array(fileSchema).min(1).max(400) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { cfEnv, deployFiles, sanitizeName } = await import("./cf.server");
    return deployFiles(cfEnv(), sanitizeName(data.projectName), data.files);
  });

export const getSiteStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ projectName: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { cfEnv, projectStatus } = await import("./cf.server");
    return projectStatus(cfEnv(), data.projectName);
  });

export const deleteSite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ projectName: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { cfEnv, removeProject } = await import("./cf.server");
    return removeProject(cfEnv(), data.projectName);
  });

export const checkCloudflare = createServerFn({ method: "GET" }).handler(async () => {
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
  return { configured: Boolean(token && accountId) };
});
