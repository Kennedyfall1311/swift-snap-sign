import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, MessageCircle, RefreshCw, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { generateSignLink } from "@/lib/admin.functions";
import { buildWhatsAppUrl, formatDateTime, signLinkUrl } from "@/lib/format";
import { settingsQuery, type Client } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";

export function LinkDialog({
  client,
  onOpenChange,
}: {
  client: Client | null;
  onOpenChange: (o: boolean) => void;
}) {
  const gen = useServerFn(generateSignLink);
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const [link, setLink] = useState<{ token: string; expiresAt: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create(regenerate = false) {
    if (!client) return;
    setLoading(true);
    try {
      const r = await gen({ data: { clientId: client.id, regenerate } });
      setLink({ token: r.token, expiresAt: r.expiresAt });
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (regenerate) toast.success("Novo link gerado");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível gerar o link");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLink(null);
    setCopied(false);
    if (client) create(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  const url = link ? signLinkUrl(link.token) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function whatsapp() {
    if (!client || !settings) return;
    window.open(buildWhatsAppUrl(client.phone, settings.whatsapp_message, client.name, url), "_blank", "noopener");
  }

  return (
    <Dialog open={!!client} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Link de assinatura</DialogTitle>
          <DialogDescription>{client?.name}</DialogDescription>
        </DialogHeader>

        {loading || !link ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="break-all rounded-xl bg-muted p-3 font-mono text-xs text-muted-foreground">{url}</div>
            {link.expiresAt && (
              <p className="text-xs text-muted-foreground">Válido até {formatDateTime(link.expiresAt)}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={copy}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-semibold hover:bg-muted"
              >
                {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />} Copiar link
              </button>
              <button
                onClick={whatsapp}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </button>
            </div>
            <button
              onClick={() => create(true)}
              className="flex w-full items-center justify-center gap-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3.5" /> Gerar novo link (invalida o atual)
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
