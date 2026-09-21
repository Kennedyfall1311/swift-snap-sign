import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Verifica" },
      { name: "description", content: "Acesso administrativo ao painel de assinaturas." },
      { property: "og:title", content: "Entrar — Verifica" },
      { property: "og:description", content: "Acesso administrativo ao painel de assinaturas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(72),
  name: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  // eslint-disable-next-line consistent-return
  async function submit(e: React.FormEvent): Promise<unknown> {
    e.preventDefault();
    setInfo(null);
    if (mode === "forgot") {
      const em = z.string().trim().email().safeParse(email);
      if (!em.success) return toast.error("Informe um e-mail válido");
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(em.data, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      setInfo("Enviamos um link para redefinir sua senha. Verifique seu e-mail.");
      return;
    }
    const parsed = schema.safeParse({ email, password, name: name || undefined });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      setLoading(false);
      if (error) return toast.error("E-mail ou senha incorretos");
      navigate({ to: "/dashboard", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: window.location.origin, data: { name: parsed.data.name } },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setInfo("Conta criada. Confirme seu e-mail pelo link enviado e depois faça login.");
    }
  }

  const inputCls =
    "mt-2 w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">Verifica</span>
        </div>
        <h1 className="mt-8 text-3xl font-semibold">
          {mode === "login" ? "Acesso administrativo" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "login"
            ? "Entre para gerenciar clientes e assinaturas."
            : mode === "signup"
              ? "A primeira conta criada será o administrador."
              : "Informe seu e-mail para receber o link de redefinição."}
        </p>

        <form onSubmit={submit} className="mt-6 rounded-2xl bg-card p-6 ring-1 ring-border">
          {mode === "signup" && (
            <label className="block text-sm font-semibold">
              Nome
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className={`block text-sm font-semibold ${mode === "signup" ? "mt-4" : ""}`}>
            E-mail
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {mode !== "forgot" && (
            <label className="mt-4 block text-sm font-semibold">
              Senha
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </label>
          )}
          {info && <p className="mt-4 rounded-lg bg-ok-soft p-3 text-sm text-ok-ink">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
          {mode === "login" ? (
            <>
              <button className="text-primary hover:underline" onClick={() => setMode("forgot")}>
                Esqueci minha senha
              </button>
              <button className="text-muted-foreground hover:underline" onClick={() => setMode("signup")}>
                Criar conta
              </button>
            </>
          ) : (
            <button className="text-primary hover:underline" onClick={() => setMode("login")}>
              Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
