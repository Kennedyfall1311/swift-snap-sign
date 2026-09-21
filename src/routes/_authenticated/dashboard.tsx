import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { clientsQuery, type Client, type ClientWithSignatures } from "@/lib/queries";
import { ClientRow } from "@/components/admin/ClientRow";
import { ClientFormDialog } from "@/components/admin/ClientFormDialog";
import { SignatureRequestDialog } from "@/components/admin/SignatureRequestDialog";
import { SignatureViewDialog } from "@/components/admin/SignatureViewDialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Verifica" },
      { name: "description", content: "Visão geral das assinaturas em tempo real." },
      { property: "og:title", content: "Dashboard — Verifica" },
      { property: "og:description", content: "Visão geral das assinaturas em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function startOfTodaySP() {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  sp.setHours(0, 0, 0, 0);
  const offset = now.getTime() - new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getTime();
  return new Date(sp.getTime() + offset);
}

function DashboardPage() {
  const { data: clients = [], isLoading } = useQuery(clientsQuery);
  const [formOpen, setFormOpen] = useState(false);
  const [linkClient, setLinkClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<ClientWithSignatures | null>(null);

  const today = startOfTodaySP();
  const total = clients.length;
  const pending = clients.filter((c) => c.status === "PENDENTE").length;
  const signed = clients.filter((c) => c.status === "ASSINADO").length;
  const signedToday = clients.filter((c) => c.signed_at && new Date(c.signed_at) >= today).length;
  const recent = [...clients]
    .sort((a, b) => (b.signed_at ?? b.updated_at).localeCompare(a.signed_at ?? a.updated_at))
    .slice(0, 8);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão geral das assinaturas em tempo real</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
        >
          <Plus className="size-4" /> Novo cliente
        </button>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total de clientes" value={total} tone="paper" hint="cadastrados" />
        <Stat label="Aguardando assinatura" value={pending} tone="pending" hint="links ativos" />
        <Stat
          label="Assinados"
          value={signed}
          tone="ok"
          hint={total ? `taxa de ${Math.round((signed / total) * 100)}%` : "—"}
        />
        <Stat label="Assinaturas hoje" value={signedToday} tone="brand" hint="desde 00:00" />
      </div>

      <div className="mt-8 rounded-2xl bg-card ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Assinaturas recentes</h2>
            <p className="text-xs text-muted-foreground">Atualização automática em tempo real</p>
          </div>
          <Link to="/assinaturas" className="text-sm font-medium text-primary hover:text-primary-strong">
            Ver todas →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : recent.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium">Nenhum cliente ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">Cadastre o primeiro cliente para gerar um link de assinatura.</p>
            </div>
          ) : (
            recent.map((c) => (
              <ClientRow key={c.id} c={c} actions={{ onView: setViewClient, onLink: setLinkClient }} />
            ))
          )}
        </div>
      </div>

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <SignatureRequestDialog open={!!linkClient} initialClient={linkClient} onOpenChange={(o) => !o && setLinkClient(null)} />
      <SignatureViewDialog client={viewClient} onOpenChange={(o) => !o && setViewClient(null)} />
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "paper" | "pending" | "ok" | "brand";
}) {
  const cls = {
    paper: "bg-card ring-1 ring-border text-foreground [&_.lbl]:text-muted-foreground [&_.hint]:text-muted-foreground",
    pending: "bg-pending-soft ring-1 ring-pending/20 text-pending-ink [&_.lbl]:text-pending-ink [&_.hint]:text-pending-ink/80",
    ok: "bg-ok-soft ring-1 ring-ok/20 text-ok-ink [&_.lbl]:text-ok-ink [&_.hint]:text-ok-ink/80",
    brand: "bg-primary text-primary-foreground [&_.lbl]:text-secondary [&_.hint]:text-secondary/90",
  }[tone];
  return (
    <div className={`rounded-2xl p-5 ${cls}`}>
      <p className="lbl text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-3 font-display text-4xl font-semibold leading-none">{value}</p>
      <p className="hint mt-3 text-xs font-medium">{hint}</p>
    </div>
  );
}
