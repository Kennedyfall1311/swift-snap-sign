import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { clientsQuery, type Client, type ClientWithSignatures } from "@/lib/queries";
import { onlyDigits } from "@/lib/format";
import { ClientRow } from "@/components/admin/ClientRow";
import { LinkDialog } from "@/components/admin/LinkDialog";
import { SignatureViewDialog } from "@/components/admin/SignatureViewDialog";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  head: () => ({
    meta: [
      { title: "Assinaturas — Verifica" },
      { name: "description", content: "Acompanhe assinaturas pendentes, concluídas e canceladas." },
      { property: "og:title", content: "Assinaturas — Verifica" },
      { property: "og:description", content: "Acompanhe assinaturas pendentes, concluídas e canceladas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignaturesPage,
});

type Filter = "TODAS" | "PENDENTE" | "ASSINADO" | "CANCELADO";
const filters: { key: Filter; label: string }[] = [
  { key: "TODAS", label: "Todas" },
  { key: "PENDENTE", label: "Pendentes" },
  { key: "ASSINADO", label: "Assinadas" },
  { key: "CANCELADO", label: "Canceladas" },
];

export function useFilteredClients(filter: Filter, q: string) {
  const { data: clients = [], isLoading } = useQuery(clientsQuery);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = onlyDigits(q);
    return clients.filter((c) => {
      if (filter !== "TODAS" && c.status !== filter) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (digits.length > 0 && (c.cpf.includes(digits) || c.phone.includes(digits)))
      );
    });
  }, [clients, filter, q]);
  return { list, isLoading };
}

export function FilterBar({
  filter,
  setFilter,
  q,
  setQ,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  q: string;
  setQ: (s: string) => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-card p-1 ring-1 ring-border">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              filter === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm sm:w-72">
        <Search className="size-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Nome, CPF ou telefone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
    </div>
  );
}

function SignaturesPage() {
  const [filter, setFilter] = useState<Filter>("TODAS");
  const [q, setQ] = useState("");
  const { list, isLoading } = useFilteredClients(filter, q);
  const [linkClient, setLinkClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<ClientWithSignatures | null>(null);

  return (
    <>
      <h1 className="text-3xl font-semibold">Assinaturas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Todos os registros de assinatura</p>
      <FilterBar filter={filter} setFilter={setFilter} q={q} setQ={setQ} />

      <div className="mt-5 rounded-2xl bg-card ring-1 ring-border">
        <div className="divide-y divide-border">
          {isLoading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            list.map((c) => <ClientRow key={c.id} c={c} actions={{ onView: setViewClient, onLink: setLinkClient }} />)
          )}
        </div>
      </div>

      <LinkDialog client={linkClient} onOpenChange={(o) => !o && setLinkClient(null)} />
      <SignatureViewDialog client={viewClient} onOpenChange={(o) => !o && setViewClient(null)} />
    </>
  );
}
