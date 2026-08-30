import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const prepareSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectName: string; title: string }) =>
    z.object({ projectName: z.string().min(1).max(60), title: z.string().max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const existing = await context.supabase
      .from("sites")
      .select("*")
      .eq("project_name", data.projectName)
      .maybeSingle();
    if (existing.data) return existing.data;
    const { data: row, error } = await context.supabase
      .from("sites")
      .insert({
        user_id: context.userId,
        project_name: data.projectName,
        title: data.title,
        url: `https://${data.projectName}.pages.dev`,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const finalizeSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; url: string }) =>
    z.object({ id: uuid, url: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sites")
      .update({ url: data.url, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSiteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectName: string }) =>
    z.object({ projectName: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sites")
      .delete()
      .eq("project_name", data.projectName);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFeedbackEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; enabled: boolean }) =>
    z.object({ id: uuid, enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sites")
      .update({ feedback_enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { siteId: string }) => z.object({ siteId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("feedback")
      .select("*")
      .eq("site_id", data.siteId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) =>
    z.object({ id: uuid, status: z.enum(["open", "done"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("feedback")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("feedback").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAnnotations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { siteId: string }) => z.object({ siteId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("annotations")
      .select("*")
      .eq("site_id", data.siteId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { siteId: string; type: string; data: Record<string, unknown> }) =>
    z
      .object({
        siteId: uuid,
        type: z.enum(["note", "arrow", "box"]),
        data: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("annotations")
      .insert({
        site_id: data.siteId,
        user_id: context.userId,
        type: data.type,
        data: data.data as never,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("annotations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
