import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Keeps the admin lists fresh when a client signs. */
export function useRealtimeClients() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        const next = payload.new as { status?: string; name?: string } | undefined;
        const prev = payload.old as { status?: string } | undefined;
        if (payload.eventType === "UPDATE" && next?.status === "ASSINADO" && prev?.status !== "ASSINADO") {
          toast.success(`${next.name ?? "Cliente"} concluiu a assinatura`);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "signatures" }, () => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
