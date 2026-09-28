import { Copy, Eye, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PhotoThumb } from "./PhotoThumb";
import { StatusBadge } from "./StatusBadge";
import { buildWhatsAppUrl, formatDateTime, formatDocument, signLinkUrl } from "@/lib/format";
import { settingsQuery, type ClientWithSignatures, type SignatureWithDocuments } from "@/lib/queries";

export type SignatureSelection = { client: ClientWithSignatures; signature: SignatureWithDocuments };

export function SignatureRow({ client, signature, onView }: SignatureSelection & { onView: (selection: SignatureSelection) => void }) {
  const { data: settings } = useQuery(settingsQuery);
  const pending = signature.status === "PENDENTE";
  const url = pending ? signLinkUrl(signature.token) : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  function sendWhatsApp() {
    if (!settings) return;
    if (!client.phone || ![10, 11, 12, 13].includes(client.phone.replace(/\D/g, "").length)) {
      toast.error("Cadastre um telefone válido para enviar pelo WhatsApp");
      return;
    }
    window.open(buildWhatsAppUrl(client.phone, settings.whatsapp_message, client.name, url), "_blank", "noopener");
  }

  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
      <PhotoThumb path={signature.photo_path ?? client.photo_path} onClick={() => onView({ client, signature })} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{signature.title}</p>
        <p className="truncate text-xs text-muted-foreground">{client.name} · {client.codigo} · {formatDocument(client.cpf, client.tipo_pessoa)}</p>
        <p className="mt-1 text-xs text-muted-foreground sm:hidden">{formatDateTime(signature.signed_at ?? signature.created_at)}</p>
      </div>
      <StatusBadge status={signature.status} className="hidden shrink-0 sm:inline-flex" />
      <span className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground md:block">{formatDateTime(signature.signed_at ?? signature.created_at)}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        {pending && <>
          <Button variant="ghost" size="icon" title="Copiar link" aria-label="Copiar link" onClick={copyLink}><Copy /></Button>
          <Button variant="ghost" size="icon" title="Enviar pelo WhatsApp" aria-label="Enviar pelo WhatsApp" onClick={sendWhatsApp}><MessageCircle /></Button>
        </>}
        <Button variant="ghost" size="icon" title="Visualizar assinatura" aria-label="Visualizar assinatura" onClick={() => onView({ client, signature })}><Eye /></Button>
      </div>
    </div>
  );
}