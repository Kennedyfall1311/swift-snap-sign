import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { type Client, type ClientWithSignatures } from "@/lib/queries";
import { ClientRow } from "@/components/admin/ClientRow";
import { ClientFormDialog } from "@/components/admin/ClientFormDialog";
import { LinkDialog } from "@/components/admin/LinkDialog";
import { SignatureViewDialog } from "@/components/admin/SignatureViewDialog";
import { FilterBar, useFilteredClients } from "./assinaturas";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Verifica" },
      { name: "description", content: "Cadastre clientes e gere links individuais de assinatura." },
      { property: "og:title", content: "Clientes — Verifica" },
      { property: "og:description", content: "Cadastre clientes e gere links individuais de assinatura." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const [filter, setFilter] = useState<"TODAS" | "PENDENTE" | "ASSINADO" | "CANCELADO">("TODAS");
  const [q, setQ] = useState("");
  const { list, isLoading } = useFilteredClients(filter, q);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [linkClient, setLinkClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<ClientWithSignatures | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{list.length} cliente(s)</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
        >
          <Plus className="size-4" /> Novo cliente
        </button>
      </div>
      <FilterBar filter={filter} setFilter={setFilter} q={q} setQ={setQ} />

      <div className="mt-5 rounded-2xl bg-card ring-1 ring-border">
        <div className="hidden grid-cols-[44px_1fr_auto_144px_auto] items-center gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
          <span />
          <span>Nome / CPF</span>
          <span>Status</span>
          <span className="text-right">Data</span>
          <span className="pr-2 text-right">Ações</span>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            list.map((c) => (
              <ClientRow
                key={c.id}
                c={c}
                actions={{
                  onView: setViewClient,
                  onLink: setLinkClient,
                  onEdit: (cl) => {
                    setEditing(cl);
                    setFormOpen(true);
                  },
                }}
              />
            ))
          )}
        </div>
      </div>

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editing}
        onSaved={(c) => {
          if (!editing) setLinkClient(c);
        }}
      />
      <LinkDialog client={linkClient} onOpenChange={(o) => !o && setLinkClient(null)} />
      <SignatureViewDialog client={viewClient} onOpenChange={(o) => !o && setViewClient(null)} />
    </>
  );
}
