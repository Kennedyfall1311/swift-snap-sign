import { CheckCircle2, Clock, ExternalLink, FileText, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PhotoThumb, usePhotoUrl } from "./PhotoThumb";
import { StatusBadge } from "./StatusBadge";
import { formatDateTime, formatDocument, formatPhone, signLinkUrl } from "@/lib/format";
import { getPrivateFileUrl } from "@/lib/admin.functions";
import type { SignatureSelection } from "./SignatureRow";

export function SignatureViewDialog({
  selection,
  onOpenChange,
}: {
  selection: SignatureSelection | null;
  onOpenChange: (o: boolean) => void;
}) {
  const client = selection?.client;
  const sig = selection?.signature;
  const { data: photo } = usePhotoUrl(sig?.photo_path);
  const privateUrl = useServerFn(getPrivateFileUrl);
  const { data: mark } = useQuery({ queryKey: ["signature-mark", sig?.signature_path], queryFn: () => privateUrl({ data: { bucket: "signature-marks", path: sig?.signature_path ?? "" } }), enabled: !!sig?.signature_path });

  return (
    <Dialog open={!!selection} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Assinatura</DialogTitle>
          <DialogDescription>Detalhes do registro</DialogDescription>
        </DialogHeader>
        {client && sig && (
          <div className="space-y-4">
            {sig?.photo_path ? (
              <a href={photo?.url} target="_blank" rel="noopener" className="block">
                <PhotoThumb path={sig.photo_path} size="lg" />
              </a>
            ) : (
              <PhotoThumb path={null} size="lg" />
            )}

            {sig && <div><h3 className="font-semibold">{sig.title}</h3>{sig.description && <p className="mt-1 text-sm text-muted-foreground">{sig.description}</p>}{sig.signature_documents?.length > 0 && <div className="mt-3 space-y-2">{sig.signature_documents.map((doc) => <AdminDocument key={doc.id} path={doc.storage_path} name={doc.file_name} />)}</div>}</div>}
            {mark?.url && <div><p className="mb-2 text-sm font-semibold">Assinatura manual</p><div className="rounded-xl border border-border bg-background p-3"><img src={mark.url} alt="Assinatura manual" className="h-28 w-full object-contain" /></div></div>}

             {sig.status === "ASSINADO" ? (
              <div className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 font-semibold text-ok-ink">
                <CheckCircle2 className="size-5" /> ASSINATURA CONFIRMADA
              </div>
              ) : sig.status === "CANCELADO" ? (
              <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger-ink">
                <XCircle className="size-5" /> CANCELADO
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-pending-soft px-4 py-3 font-semibold text-pending-ink">
                <Clock className="size-5" /> AGUARDANDO ASSINATURA
              </div>
            )}

            <dl className="divide-y divide-border text-sm">
              <Row k="Nome completo" v={sig.signer_name ?? client.name} />
               <Row k={client.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} v={<span className="font-mono">{formatDocument(sig.signer_document ?? sig.signer_cpf ?? client.cpf, client.tipo_pessoa)}</span>} />
              <Row k="Telefone" v={formatPhone(client.phone)} />
               <Row k="Status" v={<StatusBadge status={sig.status} />} />
              <Row k="Data e hora" v={formatDateTime(sig.signed_at)} />
              <Row k="IP" v={<span className="font-mono">{sig.ip_address ?? "—"}</span>} />
              <Row k="Identificador" v={<span className="break-all font-mono text-xs">{sig.id}</span>} />
              {sig && sig.status === "PENDENTE" && (
                <Row k="Link" v={<span className="break-all font-mono text-xs">{signLinkUrl(sig.token)}</span>} />
              )}
              {sig?.user_agent && <Row k="Dispositivo" v={<span className="text-xs">{sig.user_agent}</span>} />}
              {client.notes && <Row k="Observação" v={client.notes} />}
            </dl>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdminDocument({ path, name }: { path: string; name: string }) {
  const getUrl = useServerFn(getPrivateFileUrl);
  const { data } = useQuery({ queryKey: ["document", path], queryFn: () => getUrl({ data: { bucket: "documents", path } }) });
  return <a href={data?.url} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"><FileText className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate">{name}</span><ExternalLink className="size-3.5" /></a>;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 font-medium">{v}</dd>
    </div>
  );
}
