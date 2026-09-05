import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("ИИ недоступен: не настроен ключ.");
  return key;
}

async function gateway(body: Record<string, unknown>) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) throw new Error("Слишком много запросов к ИИ, попробуйте позже.");
    if (res.status === 402) throw new Error("Закончились кредиты ИИ.");
    throw new Error(`Ошибка ИИ (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        images?: Array<{ image_url?: { url?: string } }>;
      };
    }>;
  };
}

/** Generates an on-topic image for a specific slot of the site. */
export const aiGenerateImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        prompt: z.string().min(2).max(600),
        width: z.number().int().positive().max(4000).default(800),
        height: z.number().int().positive().max(4000).default(600),
        context: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ratio = (data.width / Math.max(data.height, 1)).toFixed(2);
    const orientation =
      data.width > data.height * 1.2
        ? "горизонтальная (landscape)"
        : data.height > data.width * 1.2
          ? "вертикальная (portrait)"
          : "квадратная";
    const prompt = [
      `Создай изображение для блока сайта. Что нужно: ${data.prompt}.`,
      data.context ? `Контекст страницы: ${data.context}` : "",
      `Пропорции: ${orientation}, соотношение сторон примерно ${ratio}:1 (место ${data.width}×${data.height}px).`,
      "Максимально высокая детализация и резкость, без текста и надписей, без водяных знаков, без рамок и полей — изображение должно занимать весь кадр.",
    ]
      .filter(Boolean)
      .join(" ");

    const json = await gateway({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    });
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("ИИ не вернул изображение, попробуйте ещё раз.");
    return { url };
  });

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

async function fetchSiteText(url: string) {
  const fc = process.env["FIRECRAWL_API_KEY"];
  if (fc && fc.startsWith("fc-")) {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${fc}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (res.ok) {
      const j = (await res.json()) as { markdown?: string; data?: { markdown?: string } };
      const md = j.markdown ?? j.data?.markdown;
      if (md) return md;
    }
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PixeliftBot/1.0)" },
  });
  if (!res.ok) throw new Error(`Не удалось открыть сайт (${res.status}).`);
  return stripHtml(await res.text());
}

const slotSchema = z.object({
  selector: z.string().min(1),
  label: z.string().default(""),
  value: z.string().default(""),
});

/** Reads a donor site and rewrites the текстовые слоты шаблона под него. */
export const aiTransferContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z.string().url(),
        slots: z.array(slotSchema).min(1).max(120),
        instructions: z.string().max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const source = (await fetchSiteText(data.url)).slice(0, 18000);

    const list = data.slots
      .map((s, i) => `${i}. [${s.selector}] сейчас: ${JSON.stringify(s.value.slice(0, 160))}`)
      .join("\n");

    const json = await gateway({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Ты переносишь контент сайта-донора в готовый шаблон. Отвечай ТОЛЬКО валидным JSON вида " +
            '{"items":[{"index":0,"value":"новый текст"}],"summary":"кратко"}. ' +
            "Сохраняй смысловую роль каждого слота (заголовок остаётся заголовком, кнопка — кнопкой) " +
            "и примерно ту же длину текста. Пиши на языке сайта-донора. " +
            "Если для слота нет подходящей информации — не включай его в ответ.",
        },
        {
          role: "user",
          content: `Контент сайта-донора (${data.url}):\n${source}\n\nСлоты шаблона:\n${list}\n\n${
            data.instructions ? `Дополнительно: ${data.instructions}` : ""
          }`,
        },
      ],
    });

    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("ИИ вернул неожиданный ответ.");
    const parsed = z
      .object({
        items: z.array(z.object({ index: z.number().int(), value: z.string() })).default([]),
        summary: z.string().default(""),
      })
      .parse(JSON.parse(match[0]));

    const items = parsed.items
      .filter((i) => data.slots[i.index] && i.value.trim())
      .map((i) => ({ selector: data.slots[i.index]!.selector, value: i.value.trim() }));

    return { items, summary: parsed.summary };
  });
