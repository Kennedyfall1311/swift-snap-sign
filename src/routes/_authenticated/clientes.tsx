import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { clientsQuery, type Client } from "@/lib/queries";
import { formatDocument, formatPhone, onlyDigits } from "@/lib/format";
import { ClientFormDialog } from "@/components/admin/ClientFormDialog";
import { PhotoThumb } from "@/components/admin/PhotoThumb";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Verifica" },
      { name: "description", content: "Consulte e mantenha o cadastro de clientes." },
      { property: "og:title", content: "Clientes — Verifica" },
      { property: "og:description", content: "Consulte e mantenha o cadastro de clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const [q, setQ] = useState("");
  const { data: clients = [], isLoading } = useQuery(clientsQuery);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = onlyDigits(q);
    if (!term) return clients;
    return clients.filter((client) =>
      client.name.toLowerCase().includes(term) ||
      client.codigo.toLowerCase().includes(term) ||
      client.apelido?.toLowerCase().includes(term) ||
      (digits.length > 0 && (client.cpf.includes(digits) || client.phone.includes(digits))),
    );
  }, [clients, q]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
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

      <label className="mt-6 flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm sm:max-w-md">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Código, CPF, CNPJ, nome ou telefone"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </label>

      <div className="mt-5 rounded-2xl bg-card ring-1 ring-border">
        <div className="hidden grid-cols-[44px_minmax(0,1fr)_minmax(180px,0.65fr)_auto] items-center gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
          <span />
          <span>Cliente</span>
          <span>Contato</span>
          <span className="pr-2 text-right">Ações</span>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            list.map((client) => <ClientRegistrationRow key={client.id} client={client} onEdit={() => { setEditing(client); setFormOpen(true); }} />)
          )}
        </div>
      </div>

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editing}
        onSaved={() => {}}
      />
    </>
  );
}

function ClientRegistrationRow({ client, onEdit }: { client: Client; onEdit: () => void }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5 md:grid-cols-[44px_minmax(0,1fr)_minmax(180px,0.65fr)_auto]">
      <PhotoThumb path={client.photo_path} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{client.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {client.codigo} · {formatDocument(client.cpf, client.tipo_pessoa)}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground md:hidden">{formatPhone(client.phone)}</p>
      </div>
      <div className="hidden min-w-0 md:block">
        <p className="truncate text-sm">{formatPhone(client.phone)}</p>
        <p className="truncate text-xs text-muted-foreground">{[client.cidade, client.uf].filter(Boolean).join(" / ") || "Local não informado"}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        title="Editar cliente"
        aria-label={`Editar ${client.name}`}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil className="size-4" />
      </button>
    </div>
  );
}
