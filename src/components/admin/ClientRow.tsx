import { Copy, Eye, Link2, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { PhotoThumb } from "./PhotoThumb";
import { StatusBadge } from "./StatusBadge";
import { buildWhatsAppUrl, formatDateTime, formatDocument, signLinkUrl } from "@/lib/format";
import { latestSignature, settingsQuery, type ClientWithSignatures } from "@/lib/queries";

export type RowActions = {
  onView: (c: ClientWithSignatures) => void;
  onEdit?: (c: ClientWithSignatures) => void;
  onLink?: (c: ClientWithSignatures) => void;
};

function IconBtn({
  title,
  onClick,
  children,
  primary,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-lg transition-colors ${
        primary ? "text-primary hover:bg-secondary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function ClientRow({ c, actions, compact }: { c: ClientWithSignatures; actions: RowActions; compact?: boolean }) {
  const sig = latestSignature(c);
  const pendingLink = sig && sig.status === "PENDENTE" ? sig : null;
  const { data: settings } = useQuery(settingsQuery);

  const copy = async () => {
    if (!pendingLink) return actions.onLink?.(c);
    await navigator.clipboard.writeText(signLinkUrl(pendingLink.token));
    toast.success("Link copiado");
  };
  const wa = () => {
    if (!pendingLink || !settings) return actions.onLink?.(c);
    window.open(
      buildWhatsAppUrl(c.phone, settings.whatsapp_message, c.name, signLinkUrl(pendingLink.token)),
      "_blank",
      "noopener",
    );
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
       <PhotoThumb path={sig?.photo_path ?? c.photo_path} onClick={() => actions.onView(c)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{c.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{c.codigo} · {formatDocument(c.cpf, c.tipo_pessoa)}</p>
        <div className="mt-1 flex items-center gap-2 sm:hidden">
           <StatusBadge status={sig?.status ?? c.status} />
          {c.signed_at && <span className="text-[11px] text-muted-foreground">{formatDateTime(c.signed_at)}</span>}
        </div>
      </div>
       <StatusBadge status={sig?.status ?? c.status} className="hidden sm:inline-flex" />
      {!compact && (
        <p className="hidden w-36 shrink-0 text-right text-xs text-muted-foreground md:block">
           {(sig?.status ?? c.status) === "ASSINADO"
            ? formatDateTime(c.signed_at)
            : pendingLink
              ? `link gerado ${formatDateTime(pendingLink.created_at)}`
              : "sem link"}
        </p>
      )}
      <div className="flex shrink-0 items-center">
        {actions.onLink && c.status !== "ASSINADO" && (
          <>
            <IconBtn title={pendingLink ? "Copiar link" : "Gerar link"} onClick={copy} primary={!pendingLink}>
              {pendingLink ? <Copy className="size-4" /> : <Link2 className="size-4" />}
            </IconBtn>
            <IconBtn title="Enviar pelo WhatsApp" onClick={wa}>
              <MessageCircle className="size-4" />
            </IconBtn>
          </>
        )}
        {actions.onEdit && (
          <IconBtn title="Editar" onClick={() => actions.onEdit!(c)}>
            <Pencil className="size-4" />
          </IconBtn>
        )}
        <IconBtn title="Visualizar" onClick={() => actions.onView(c)}>
          <Eye className="size-4" />
        </IconBtn>
      </div>
    </div>
  );
}
