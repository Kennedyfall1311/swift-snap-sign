import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCEP, formatDateTime, formatDocument, formatPhone, isValidDocument, onlyDigits } from "@/lib/format";
import { logAudit } from "@/lib/admin.functions";
import type { Client, ClientWithSignatures, SignatureWithDocuments } from "@/lib/queries";
import { PhotoThumb } from "./PhotoThumb";
import { StatusBadge } from "./StatusBadge";
import { isVps } from '@/lib/vps/mode';
import { localSaveClient } from '@/lib/vps/admin.functions';

const schema = z.object({
  codigo: z.string().trim().min(1, "Informe o código").max(40),
  tipo_pessoa: z.enum(["PF", "PJ"]),
  name: z.string().trim().min(3, "Informe o nome completo").max(120),
  cpf: z.string(),
  phone: z.string().refine((v) => onlyDigits(v).length >= 10, "Telefone inválido"),
  rg: z.string().trim().max(30).optional(), orgao_expedidor: z.string().trim().max(30).optional(),
  apelido: z.string().trim().max(120).optional(), endereco: z.string().trim().max(180).optional(),
  complemento: z.string().trim().max(100).optional(), bairro: z.string().trim().max(100).optional(),
  cidade: z.string().trim().max(100).optional(), uf: z.string().trim().max(2).optional(),
  pais: z.string().trim().max(60), cep: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((d) => isValidDocument(d.cpf, d.tipo_pessoa), { path: ["cpf"], message: "CPF/CNPJ inválido" });

export const fieldCls =
  "mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
  onViewSignature,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client?: ClientWithSignatures | null;
  onSaved?: (c: Client) => void;
  onViewSignature?: (signature: SignatureWithDocuments) => void;
}) {
  const qc = useQueryClient();
  const audit = useServerFn(logAudit);
  const [name, setName] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<"PF" | "PJ">("PF");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState({ rg: "", orgao_expedidor: "", apelido: "", endereco: "", complemento: "", bairro: "", cidade: "", uf: "", pais: "Brasil", cep: "" });

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setCodigo(client?.codigo ?? "");
      setTipoPessoa(client?.tipo_pessoa === "PJ" ? "PJ" : "PF");
      setCpf(client ? formatDocument(client.cpf, client.tipo_pessoa) : "");
      setPhone(client ? formatPhone(client.phone) : "");
      setNotes(client?.notes ?? "");
      setExtra({ rg: client?.rg ?? "", orgao_expedidor: client?.orgao_expedidor ?? "", apelido: client?.apelido ?? "", endereco: client?.endereco ?? "", complemento: client?.complemento ?? "", bairro: client?.bairro ?? "", cidade: client?.cidade ?? "", uf: client?.uf ?? "", pais: client?.pais ?? "Brasil", cep: client ? formatCEP(client.cep ?? "") : "" });
    }
  }, [open, client]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ codigo, tipo_pessoa: tipoPessoa, name, cpf, phone, ...extra, notes: notes || undefined });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      const payload = {
        name: parsed.data.name,
        cpf: onlyDigits(parsed.data.cpf),
        phone: onlyDigits(parsed.data.phone),
        codigo: parsed.data.codigo,
        tipo_pessoa: parsed.data.tipo_pessoa,
        rg: parsed.data.rg || null, orgao_expedidor: parsed.data.orgao_expedidor || null,
        apelido: parsed.data.apelido || null, endereco: parsed.data.endereco || null,
        complemento: parsed.data.complemento || null, bairro: parsed.data.bairro || null,
        cidade: parsed.data.cidade || null, uf: parsed.data.uf?.toUpperCase() || null,
        pais: parsed.data.pais, cep: onlyDigits(parsed.data.cep ?? "") || null,
        notes: parsed.data.notes ?? null,
      };
      if (isVps) return await localSaveClient({ data: { payload, id: client?.id } }) as Client;
      if (client) {
        const { data, error } = await supabase.from("clients").update(payload).eq("id", client.id).select().single();
        if (error) throw error;
        audit({ data: { action: "client.updated", entity: "client", entityId: data.id } }).catch(() => {});
        return data;
      }
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...payload, created_by: u.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      audit({ data: { action: "client.created", entity: "client", entityId: data.id } }).catch(() => {});
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(client ? "Cliente atualizado" : "Cliente cadastrado");
      onOpenChange(false);
      onSaved?.(data);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>O cadastro fica disponível para uso nas solicitações de assinatura.</DialogDescription>
        </DialogHeader>
        {client && (
          <div className="flex items-center gap-4 rounded-xl bg-muted p-3">
            <PhotoThumb path={client.photo_path} className="size-16" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Foto do cliente</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {client.photo_path ? "Registrada na primeira assinatura com foto." : "Será preenchida na primeira assinatura com foto."}
              </p>
            </div>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <label className="block text-sm font-semibold">Código<input className={fieldCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus /></label>
          <label className="block text-sm font-semibold">Tipo de pessoa<select className={fieldCls} value={tipoPessoa} onChange={(e) => { const t = e.target.value as "PF" | "PJ"; setTipoPessoa(t); setCpf(""); }}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></select></label>
          <label className="block text-sm font-semibold">
            {tipoPessoa === "PJ" ? "Razão social" : "Nome completo"}
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">{tipoPessoa === "PJ" ? "Nome fantasia" : "Apelido"}<input className={fieldCls} value={extra.apelido} onChange={(e) => setExtra((x) => ({...x, apelido:e.target.value}))} /></label>
          <label className="block text-sm font-semibold">
            {tipoPessoa === "PJ" ? "CNPJ" : "CPF"}
            <input
              className={`${fieldCls} font-mono`}
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatDocument(e.target.value, tipoPessoa))}
              placeholder={tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
            />
          </label>
          <label className="block text-sm font-semibold">RG / Inscrição estadual<input className={fieldCls} value={extra.rg} onChange={(e) => setExtra((x) => ({...x, rg:e.target.value}))} /></label>
          <label className="block text-sm font-semibold">Órgão expedidor<input className={fieldCls} value={extra.orgao_expedidor} onChange={(e) => setExtra((x) => ({...x, orgao_expedidor:e.target.value}))} /></label>
          <label className="block text-sm font-semibold">
            Telefone (WhatsApp)
            <input
              className={fieldCls}
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
            />
          </label>
          <label className="block text-sm font-semibold">Endereço<input className={fieldCls} value={extra.endereco} onChange={(e) => setExtra((x) => ({...x, endereco:e.target.value}))} /></label>
          <label className="block text-sm font-semibold">Complemento<input className={fieldCls} value={extra.complemento} onChange={(e) => setExtra((x) => ({...x, complemento:e.target.value}))} /></label>
          <label className="block text-sm font-semibold">Bairro<input className={fieldCls} value={extra.bairro} onChange={(e) => setExtra((x) => ({...x, bairro:e.target.value}))} /></label>
          <label className="block text-sm font-semibold">Cidade<input className={fieldCls} value={extra.cidade} onChange={(e) => setExtra((x) => ({...x, cidade:e.target.value}))} /></label>
          <label className="block text-sm font-semibold">UF<input className={fieldCls} maxLength={2} value={extra.uf} onChange={(e) => setExtra((x) => ({...x, uf:e.target.value.toUpperCase()}))} /></label>
          <label className="block text-sm font-semibold">País<input className={fieldCls} value={extra.pais} onChange={(e) => setExtra((x) => ({...x, pais:e.target.value}))} /></label>
          <label className="block text-sm font-semibold">CEP<input className={fieldCls} inputMode="numeric" value={extra.cep} onChange={(e) => setExtra((x) => ({...x, cep:formatCEP(e.target.value)}))} /></label>
          <label className="block text-sm font-semibold sm:col-span-2">
            Observação <span className="font-normal text-muted-foreground">(opcional)</span>
            <textarea className={`${fieldCls} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong disabled:opacity-60 sm:col-span-2"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {client ? "Salvar alterações" : "Cadastrar cliente"}
          </button>
        </form>
        {client && onViewSignature && (
          <section className="mt-6 border-t border-border pt-5" aria-label="Histórico de assinaturas">
            <h3 className="font-display text-lg font-semibold">Histórico de assinaturas</h3>
            <p className="mt-1 text-sm text-muted-foreground">{client.signatures?.length ?? 0} solicitação(ões)</p>
            <div className="mt-3 divide-y divide-border border-y border-border">
              {client.signatures?.length ? (
                [...client.signatures]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((signature) => (
                    <div key={signature.id} className="flex min-w-0 items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{signature.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(signature.signed_at ?? signature.created_at)}</p>
                      </div>
                      <StatusBadge status={signature.status} className="shrink-0" />
                      <Button type="button" variant="ghost" size="icon" title={`Visualizar ${signature.title}`} aria-label={`Visualizar ${signature.title}`} onClick={() => onViewSignature(signature)}>
                        <Eye />
                      </Button>
                    </div>
                  ))
              ) : (
                <p className="py-5 text-sm text-muted-foreground">Nenhuma assinatura para este cliente.</p>
              )}
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
