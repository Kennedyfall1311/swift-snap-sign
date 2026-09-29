import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { clientsQuery, type SignatureWithDocuments, type ClientWithSignatures } from "@/lib/queries";
import { onlyDigits } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SignatureRow, type SignatureSelection } from "@/components/admin/SignatureRow";
import { SignatureViewDialog } from "@/components/admin/SignatureViewDialog";
import { SignatureRequestDialog } from "@/components/admin/SignatureRequestDialog";

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

export function useFilteredSignatures(filter: Filter, q: string) {
  const { data: clients = [], isLoading } = useQuery(clientsQuery);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = onlyDigits(q);
    return clients.flatMap((client: ClientWithSignatures) =>
      (client.signatures ?? []).filter((signature: SignatureWithDocuments) =>
        (filter === "TODAS" || signature.status === filter) &&
        (!term || client.name.toLowerCase().includes(term) || client.codigo.toLowerCase().includes(term) ||
          signature.title.toLowerCase().includes(term) ||
          (digits.length > 0 && (client.cpf.includes(digits) || client.phone.includes(digits))))
      ).map((signature) => ({ client, signature }))
    ).sort((a, b) => b.signature.created_at.localeCompare(a.signature.created_at));
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
          <Button
            key={f.key}
            variant="ghost"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              filter === f.key ? "!bg-primary !text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm sm:w-72">
        <Search className="size-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Código, CPF, CNPJ ou nome"
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
  const { list, isLoading } = useFilteredSignatures(filter, q);
  const [viewSelection, setViewSelection] = useState<SignatureSelection | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
       <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">Assinaturas</h1><p className="mt-1 text-sm text-muted-foreground">Crie links com documentos e acompanhe as confirmações</p></div><Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="size-4" /> Nova assinatura</Button></div>
      <FilterBar filter={filter} setFilter={setFilter} q={q} setQ={setQ} />

      <div className="mt-5 rounded-2xl bg-card ring-1 ring-border">
        <div className="divide-y divide-border">
          {isLoading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            list.map(({ client, signature }) => <SignatureRow key={signature.id} client={client} signature={signature} onView={setViewSelection} />)
          )}
        </div>
      </div>

       <SignatureViewDialog selection={viewSelection} onOpenChange={(o) => !o && setViewSelection(null)} />
      <SignatureRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
