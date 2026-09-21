import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PhotoThumb, usePhotoUrl } from "./PhotoThumb";
import { StatusBadge } from "./StatusBadge";
import { formatCPF, formatDateTime, formatPhone, signLinkUrl } from "@/lib/format";
import { latestSignature, type ClientWithSignatures } from "@/lib/queries";

export function SignatureViewDialog({
  client,
  onOpenChange,
}: {
  client: ClientWithSignatures | null;
  onOpenChange: (o: boolean) => void;
}) {
  const sig = client ? latestSignature(client) : null;
  const { data: photo } = usePhotoUrl(sig?.photo_path);

  return (
    <Dialog open={!!client} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Assinatura</DialogTitle>
          <DialogDescription>Detalhes do registro</DialogDescription>
        </DialogHeader>
        {client && (
          <div className="space-y-4">
            {sig?.photo_path ? (
              <a href={photo?.url} target="_blank" rel="noopener" className="block">
                <PhotoThumb path={sig.photo_path} size="lg" />
              </a>
            ) : (
              <PhotoThumb path={null} size="lg" />
            )}

            {client.status === "ASSINADO" ? (
              <div className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 font-semibold text-ok-ink">
                <CheckCircle2 className="size-5" /> ASSINATURA CONFIRMADA
              </div>
            ) : client.status === "CANCELADO" ? (
              <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger-ink">
                <XCircle className="size-5" /> CANCELADO
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-pending-soft px-4 py-3 font-semibold text-pending-ink">
                <Clock className="size-5" /> AGUARDANDO ASSINATURA
              </div>
            )}

            <dl className="divide-y divide-border text-sm">
              <Row k="Nome completo" v={sig?.signer_name ?? client.name} />
              <Row k="CPF" v={<span className="font-mono">{formatCPF(sig?.signer_cpf ?? client.cpf)}</span>} />
              <Row k="Telefone" v={formatPhone(client.phone)} />
              <Row k="Status" v={<StatusBadge status={client.status} />} />
              <Row k="Data e hora" v={formatDateTime(sig?.signed_at ?? client.signed_at)} />
              <Row k="IP" v={<span className="font-mono">{sig?.ip_address ?? "—"}</span>} />
              <Row k="Identificador" v={<span className="break-all font-mono text-xs">{sig?.id ?? "—"}</span>} />
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 font-medium">{v}</dd>
    </div>
  );
}
