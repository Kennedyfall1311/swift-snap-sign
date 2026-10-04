import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { isVps } from '@/lib/vps/mode';
import { getLocalAdmin, localLogout } from '@/lib/vps/auth.functions';

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (isVps) {
      const admin = await getLocalAdmin();
      if (!admin) throw redirect({ to: '/auth' });
      return { user: { id: admin.id, email: admin.email, name: admin.name }, isAdmin: true };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? "",
        name: (data.user.user_metadata?.["name"] as string | undefined) ?? undefined,
      },
      isAdmin: !!role,
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, isAdmin } = Route.useRouteContext();
  const name = user.name;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl bg-card p-8 text-center ring-1 ring-border">
          <h1 className="text-xl font-semibold">Sem permissão</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ({user.email}) ainda não tem acesso de administrador. Peça ao administrador para liberar o acesso.
          </p>
          <button
            onClick={async () => {
              if (isVps) await localLogout(); else await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell userEmail={user.email} userName={name}>
      <Outlet />
    </AdminShell>
  );
}
