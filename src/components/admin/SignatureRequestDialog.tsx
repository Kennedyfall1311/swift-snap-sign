import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, FileUp, Loader2, MessageCircle, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fieldCls } from "./ClientFormDialog";
import { clientsQuery, settingsQuery, type Client } from "@/lib/queries";
import { buildWhatsAppUrl, formatDocument, onlyDigits, signLinkUrl } from "@/lib/format";
import { generateSignLink } from "@/lib/admin.functions";

type UploadFile = { name: string; type: "application/pdf" | "image/jpeg" | "image/png"; data: string };
const accepted = ["application/pdf", "image/jpeg", "image/png"];

async function readFile(file: File): Promise<UploadFile> {
  if (!accepted.includes(file.type)) throw new Error(`${file.name}: use PDF, JPG ou PNG`);
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: tamanho máximo de 10MB`);
  const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("Falha ao ler arquivo")); r.readAsDataURL(file); });
  return { name: file.name, type: file.type as UploadFile["type"], data };
}

export function SignatureRequestDialog({ open, onOpenChange, initialClient }: { open: boolean; onOpenChange: (open: boolean) => void; initialClient?: Client | null }) {
  const { data: clients = [] } = useQuery(clientsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const create = useServerFn(generateSignLink);
  const qc = useQueryClient();
  const [client, setClient] = useState<Client | null>(initialClient ?? null);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirePhoto, setRequirePhoto] = useState(true);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ token: string } | null>(null);
  useEffect(() => { if (open) setClient(initialClient ?? null); }, [open, initialClient]);
  const matches = useMemo(() => { const t = search.trim().toLowerCase(); const d = onlyDigits(search); if (!t) return []; return clients.filter((c) => c.codigo.toLowerCase().includes(t) || (d && c.cpf.includes(d)) || c.name.toLowerCase().includes(t)).slice(0, 6); }, [clients, search]);
  const close = (value: boolean) => { if (!value) { setClient(initialClient ?? null); setSearch(""); setTitle(""); setDescription(""); setFiles([]); setResult(null); } onOpenChange(value); };
  const url = result ? signLinkUrl(result.token) : "";
  async function submit() { if (!client || title.trim().length < 3 || !files.length) { toast.error("Selecione o cliente, informe o título e anexe ao menos um documento"); return; } setLoading(true); try { const r = await create({ data: { clientId: client.id, title, description: description || undefined, requirePhoto, documents: files } }); setResult(r); qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Solicitação criada"); } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); } }
  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle className="text-xl">Nova assinatura</DialogTitle><DialogDescription>Selecione o cliente e os documentos que ele deverá assinar.</DialogDescription></DialogHeader>{result && client ? <div className="space-y-4"><div className="flex items-center gap-3 rounded-xl bg-ok-soft p-4 text-ok-ink"><Check className="size-5" /><span className="font-semibold">Link pronto para envio</span></div><div className="break-all rounded-xl bg-muted p-3 font-mono text-xs">{url}</div><div className="grid grid-cols-2 gap-3"><button onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"))} className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 font-semibold"><Copy className="size-4" /> Copiar</button><button onClick={() => settings && window.open(buildWhatsAppUrl(client.phone, settings.whatsapp_message, client.name, url), "_blank", "noopener")} className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"><MessageCircle className="size-4" /> WhatsApp</button></div></div> : <div className="space-y-4"><div><label className="text-sm font-semibold">Cliente</label>{client ? <div className="mt-2 flex items-center justify-between rounded-xl border border-border p-3"><div><p className="font-semibold">{client.name}</p><p className="text-xs text-muted-foreground">{client.codigo} · {formatDocument(client.cpf, client.tipo_pessoa)}</p></div><button onClick={() => setClient(null)} aria-label="Trocar cliente"><X className="size-4" /></button></div> : <><label className="mt-2 flex items-center gap-2 rounded-xl border border-input px-3"><Search className="size-4 text-muted-foreground" /><input className="w-full bg-transparent py-3 outline-none" placeholder="Código, CPF, CNPJ ou nome" value={search} onChange={(e) => setSearch(e.target.value)} /></label>{matches.length > 0 && <div className="mt-1 divide-y divide-border rounded-xl border border-border">{matches.map((c) => <button key={c.id} onClick={() => setClient(c)} className="block w-full px-3 py-2 text-left hover:bg-muted"><span className="block text-sm font-medium">{c.name}</span><span className="text-xs text-muted-foreground">{c.codigo} · {formatDocument(c.cpf, c.tipo_pessoa)}</span></button>)}</div>}</>}</div><label className="block text-sm font-semibold">Título da solicitação<input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Contrato de prestação de serviços" /></label><label className="block text-sm font-semibold">Descrição <span className="font-normal text-muted-foreground">(opcional)</span><textarea className={`${fieldCls} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} /></label><div><p className="text-sm font-semibold">Documentos</p><label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 p-5 font-medium text-primary"><FileUp className="size-5" /> Anexar PDF ou imagem<input type="file" multiple accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={async (e) => { try { const selected = await Promise.all(Array.from(e.target.files ?? []).map(readFile)); setFiles((old) => [...old, ...selected].slice(0, 10)); } catch (err) { toast.error((err as Error).message); } e.target.value = ""; }} /></label>{files.map((f, i) => <div key={`${f.name}-${i}`} className="mt-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"><span className="truncate">{f.name}</span><button onClick={() => setFiles((old) => old.filter((_, x) => x !== i))} aria-label="Remover arquivo"><X className="size-4" /></button></div>)}</div><label className="flex items-center gap-3 rounded-xl bg-muted p-4 text-sm font-medium"><input type="checkbox" checked={requirePhoto} onChange={(e) => setRequirePhoto(e.target.checked)} className="size-5 accent-primary" /> Exigir foto de identificação</label><button onClick={submit} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50">{loading && <Loader2 className="size-4 animate-spin" />} Gerar link de assinatura</button></div>}</DialogContent></Dialog>;
}