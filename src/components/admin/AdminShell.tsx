import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, PenLine, Users, Settings, LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeClients } from "@/hooks/useRealtimeClients";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assinaturas", label: "Assinaturas", icon: PenLine },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AdminShell({
  children,
  userEmail,
  userName,
}: {
  children: ReactNode;
  userEmail?: string | undefined;
  userName?: string | undefined;
}) {
  useRealtimeClients();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="flex min-h-screen w-full">
        <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col justify-between bg-sidebar px-5 py-6 lg:flex">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">
                <ShieldCheck className="size-5" />
              </span>
              <div className="leading-tight">
                <p className="font-display text-[15px] font-semibold text-sidebar-accent-foreground">Verifica</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground">Identificação</p>
              </div>
            </div>
            <nav className="mt-9 flex flex-col gap-1">
              {nav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeProps={{
                    className: "bg-primary text-primary-foreground font-semibold hover:bg-primary hover:text-primary-foreground",
                  }}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="rounded-xl bg-sidebar-accent p-3">
            <p className="text-[11px] font-medium text-sidebar-foreground">Conectado como</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-sidebar-accent-foreground">{userName || "Administrador"}</p>
            <p className="truncate text-[11px] text-sidebar-foreground">{userEmail}</p>
            <button
              onClick={signOut}
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-3.5" /> Sair
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="size-4" />
              </span>
              <span className="font-display text-base font-semibold">Verifica</span>
            </div>
            <button onClick={signOut} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Sair">
              <LogOut className="size-4" />
            </button>
          </header>

          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-8 sm:py-8 lg:px-10 lg:pb-8">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
