import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Verifica" },
      { name: "description", content: "Defina uma nova senha de acesso ao painel." },
      { property: "og:title", content: "Redefinir senha — Verifica" },
      { property: "og:description", content: "Defina uma nova senha de acesso ao painel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    supabase.auth.getSession().then(({ data }) => setReady(isRecovery || !!data.session));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-card p-6 ring-1 ring-border">
        <h1 className="text-2xl font-semibold">Nova senha</h1>
        {!ready ? (
          <p className="mt-2 text-sm text-muted-foreground">Abra esta página pelo link enviado ao seu e-mail.</p>
        ) : (
          <>
            <input
              type="password"
              className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong disabled:opacity-60"
            >
              Salvar senha
            </button>
          </>
        )}
      </form>
    </div>
  );
}
