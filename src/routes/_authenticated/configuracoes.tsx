import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { fieldCls } from "@/components/admin/ClientFormDialog";
import { importClients } from "@/lib/admin.functions";
import { isValidDocument, onlyDigits } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Verifica" },
      { name: "description", content: "Empresa, logo, mensagem do WhatsApp, prazo do link e senha." },
      { property: "og:title", content: "Configurações — Verifica" },
      { property: "og:description", content: "Empresa, logo, mensagem do WhatsApp, prazo do link e senha." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem");
  if (file.size > 2 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 2MB)");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Imagem inválida"));
      i.src = url;
    });
    const max = 320;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function SettingsPage() {
  const qc = useQueryClient();
  const { data: s } = useQuery(settingsQuery);
  const [form, setForm] = useState({
    company_name: "",
    logo_data: null as string | null,
    whatsapp_message: "",
    client_intro_text: "",
    link_expiry_days: 7,
    privacy_text: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (s)
      setForm({
        company_name: s.company_name,
        logo_data: s.logo_data,
        whatsapp_message: s.whatsapp_message,
        client_intro_text: s.client_intro_text,
        link_expiry_days: s.link_expiry_days,
        privacy_text: s.privacy_text,
      });
  }, [s]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        ...form,
        company_name: form.company_name.trim(),
        link_expiry_days: Math.max(0, Math.min(365, Number(form.link_expiry_days) || 0)),
      })
      .eq("id", "default");
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar");
      return;
    }
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Configurações salvas");
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <h1 className="text-3xl font-semibold">Configurações</h1>
      <p className="mt-1 text-sm text-muted-foreground">Empresa, mensagens e segurança</p>

      <form onSubmit={save} className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Empresa">
          <label className="block text-sm font-semibold">
            Nome da empresa
            <input className={fieldCls} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </label>
          <div className="mt-4">
            <p className="text-sm font-semibold">Logo</p>
            <div className="mt-2 flex items-center gap-4">
              <div className="grid size-16 place-items-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                {form.logo_data ? (
                  <img src={form.logo_data} alt="Logo" className="size-full object-contain" />
                ) : (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Sem logo</span>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Upload className="size-4" /> Enviar imagem
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      set("logo_data", await fileToLogoDataUrl(f));
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              </label>
              {form.logo_data && (
                <button type="button" onClick={() => set("logo_data", null)} className="text-muted-foreground hover:text-danger" aria-label="Remover logo">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          </div>
        </Section>

        <Section title="Links de assinatura">
          <label className="block text-sm font-semibold">
            Prazo padrão do link (dias)
            <input
              type="number"
              min={0}
              max={365}
              className={fieldCls}
              value={form.link_expiry_days}
              onChange={(e) => set("link_expiry_days", Number(e.target.value))}
            />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Use 0 para links sem expiração.</span>
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Mensagem do WhatsApp
            <textarea
              className={`${fieldCls} min-h-28`}
              value={form.whatsapp_message}
              onChange={(e) => set("whatsapp_message", e.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Use {"{NOME}"} e {"{LINK}"} para inserir o nome do cliente e o link.
            </span>
          </label>
        </Section>

        <Section title="Página do cliente">
          <label className="block text-sm font-semibold">
            Texto de instrução
            <input className={fieldCls} value={form.client_intro_text} onChange={(e) => set("client_intro_text", e.target.value)} />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Aviso de privacidade (LGPD)
            <textarea
              className={`${fieldCls} min-h-32`}
              value={form.privacy_text}
              onChange={(e) => set("privacy_text", e.target.value)}
            />
          </label>
        </Section>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-strong disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar configurações
          </button>
        </div>
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ImportSection />
        <PasswordSection />
      </div>
    </>
  );
}

const csvHeaders = ["codigo", "tipo_pessoa", "cpf_cnpj", "rg", "orgao_expedidor", "nome", "apelido", "telefone", "endereco", "complemento", "bairro", "cidade", "uf", "pais", "cep", "observacao"];
function parseCsvLine(line: string) { const out: string[] = []; let value = ""; let quoted = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; } else if ((c === ";" || c === ",") && !quoted) { out.push(value.trim()); value = ""; } else value += c; } out.push(value.trim()); return out; }
function ImportSection() {
  const importFn = useServerFn(importClients); const qc = useQueryClient(); const [loading, setLoading] = useState(false);
  const template = () => { const blob = new Blob([`${csvHeaders.join(";")}\n001;PF;12345678909;12.345.678;SSP;Nome completo;Apelido;11999999999;Rua Exemplo, 10;;Centro;São Paulo;SP;Brasil;01001000;\n`], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "modelo-clientes.csv"; a.click(); URL.revokeObjectURL(a.href); };
  const upload = async (file: File): Promise<void> => {
    if (file.size > 2 * 1024 * 1024) { toast.error("CSV muito grande (máx. 2MB)"); return; }
    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
      if (lines.length < 2 || !lines[0]) throw new Error("O arquivo não possui clientes");
      const headers = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
      const rows = lines.slice(1).map((line, index) => {
        const values = parseCsvLine(line);
        const row: Record<string, string> = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
        const tipo = row["tipo_pessoa"]?.toUpperCase() === "PJ" ? "PJ" as const : "PF" as const;
        const document = onlyDigits(row["cpf_cnpj"] ?? row["cpf"] ?? "");
        if (!row["codigo"] || !row["nome"] || !isValidDocument(document, tipo)) throw new Error(`Linha ${index + 2}: código, nome ou CPF/CNPJ inválido`);
        return { codigo: row["codigo"], tipo_pessoa: tipo, cpf: document, name: row["nome"], phone: onlyDigits(row["telefone"] ?? ""), rg: row["rg"] || null, orgao_expedidor: row["orgao_expedidor"] || null, apelido: row["apelido"] || null, endereco: row["endereco"] || null, complemento: row["complemento"] || null, bairro: row["bairro"] || null, cidade: row["cidade"] || null, uf: row["uf"]?.toUpperCase() || null, pais: row["pais"] || "Brasil", cep: onlyDigits(row["cep"] ?? "") || null, notes: row["observacao"] || null };
      });
      const result = await importFn({ data: { rows } });
      await qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`${result.imported} cliente(s) importado(s)`);
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  };
  return <Section title="Importar clientes"><p className="text-sm text-muted-foreground">Use um arquivo CSV. Cadastros com o mesmo código serão atualizados.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={template} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium"><Download className="size-4" /> Baixar modelo</button><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{loading ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} Importar CSV<input type="file" accept=".csv,text/csv" className="hidden" disabled={loading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label></div></Section>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: next,
      current_password: current,
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha alterada");
    setCurrent("");
    setNext("");
  }

  return (
    <Section title="Alterar senha">
      <form onSubmit={submit}>
        <label className="block text-sm font-semibold">
          Senha atual
          <input type="password" className={fieldCls} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Nova senha
          <input type="password" className={fieldCls} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </label>
        <button
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />} Atualizar senha
        </button>
      </form>
    </Section>
  );
}
