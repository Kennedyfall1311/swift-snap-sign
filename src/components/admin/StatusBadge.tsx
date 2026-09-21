import { cn } from "@/lib/utils";

type Status = "PENDENTE" | "ASSINADO" | "CANCELADO";

const styles: Record<Status, string> = {
  PENDENTE: "bg-pending-soft text-pending-ink",
  ASSINADO: "bg-ok-soft text-ok-ink",
  CANCELADO: "bg-danger-soft text-danger-ink",
};
const dots: Record<Status, string> = {
  PENDENTE: "bg-pending",
  ASSINADO: "bg-ok",
  CANCELADO: "bg-danger",
};
const labels: Record<Status, string> = {
  PENDENTE: "Pendente",
  ASSINADO: "Assinado",
  CANCELADO: "Cancelado",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        styles[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dots[status])} />
      {labels[status]}
    </span>
  );
}
