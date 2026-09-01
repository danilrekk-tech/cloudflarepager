import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const schema = z.object({
  token: z.string().uuid(),
  message: z.string().min(1).max(4000),
  author: z.string().max(120).optional().default(""),
  selector: z.string().max(2000).optional().default(""),
  label: z.string().max(300).optional().default(""),
  breadcrumb: z.string().max(1000).optional().default(""),
  html: z.string().max(2000).optional().default(""),
  page: z.string().max(2000).optional().default(""),
  x: z.number().optional().default(0),
  y: z.number().optional().default(0),
  kind: z.enum(["note", "element", "image"]).optional().default("note"),
});

export const Route = createFileRoute("/api/public/feedback")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400, headers: CORS });
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          return new Response("Invalid payload", { status: 400, headers: CORS });
        }
        const body = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: site } = await supabaseAdmin
          .from("sites")
          .select("id, feedback_enabled")
          .eq("feedback_token", body.token)
          .maybeSingle();

        if (!site || !site.feedback_enabled) {
          return new Response("Not allowed", { status: 403, headers: CORS });
        }

        const { error } = await supabaseAdmin.from("feedback").insert({
          site_id: site.id,
          kind: body.kind,
          selector: body.selector,
          element_label: body.label,
          message: body.message,
          author_name: body.author,
          page_url: body.page,
          x: body.x,
          y: body.y,
        });
        if (error) return new Response("Failed", { status: 500, headers: CORS });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...CORS, "content-type": "application/json" },
        });
      },
    },
  },
});
