import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход в Pixelift Deploy — история сайтов и отзывы клиентов" },
      {
        name: "description",
        content:
          "Войдите через Google, чтобы сохранять историю деплоев на Cloudflare Pages, управлять сайтами и собирать замечания клиентов.",
      },
      { property: "og:title", content: "Вход в Pixelift Deploy" },
      {
        property: "og:description",
        content: "Аккаунт хранит ваши сайты, статусы и отзывы клиентов по каждому проекту.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  async function google() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось войти через Google");
    }
  }

  async function emailAuth(mode: "in" | "up") {
    setBusy(true);
    try {
      const res =
        mode === "in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            });
      if (res.error) throw res.error;
      toast.success(mode === "in" ? "Вы вошли" : "Проверьте почту для подтверждения");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка авторизации");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Вход в Pixelift Deploy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        История деплоев, управление сайтами и замечания клиентов сохранятся за вашим аккаунтом.
      </p>

      <Button className="mt-6" size="lg" onClick={google}>
        Войти через Google
      </Button>

      <div className="my-6 h-px bg-border" />

      <input
        className="mb-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        placeholder="Пароль"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => void emailAuth("in")}>
          Войти
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          disabled={busy}
          onClick={() => void emailAuth("up")}
        >
          Регистрация
        </Button>
      </div>
    </main>
  );
}
