import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatPhone, isValidCPF, onlyDigits } from "@/lib/format";
import { logAudit } from "@/lib/admin.functions";
import type { Client } from "@/lib/queries";

const schema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo").max(120),
  cpf: z.string().refine(isValidCPF, "CPF inválido"),
  phone: z.string().refine((v) => onlyDigits(v).length >= 10, "Telefone inválido"),
  notes: z.string().trim().max(500).optional(),
});

export const fieldCls =
  "mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client?: Client | null;
  onSaved?: (c: Client) => void;
}) {
  const qc = useQueryClient();
  const audit = useServerFn(logAudit);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setCpf(client ? formatCPF(client.cpf) : "");
      setPhone(client ? formatPhone(client.phone) : "");
      setNotes(client?.notes ?? "");
    }
  }, [open, client]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ name, cpf, phone, notes: notes || undefined });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      const payload = {
        name: parsed.data.name,
        cpf: onlyDigits(parsed.data.cpf),
        phone: onlyDigits(parsed.data.phone),
        notes: parsed.data.notes ?? null,
      };
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
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Depois de salvar você poderá gerar o link de assinatura.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <label className="block text-sm font-semibold">
            Nome completo
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm font-semibold">
            CPF
            <input
              className={`${fieldCls} font-mono`}
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
            />
          </label>
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
          <label className="block text-sm font-semibold">
            Observação <span className="font-normal text-muted-foreground">(opcional)</span>
            <textarea className={`${fieldCls} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {client ? "Salvar alterações" : "Cadastrar e continuar"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
