import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type Signature = Tables<"signatures">;
export type Settings = Tables<"app_settings">;
export type ClientWithSignatures = Client & { signatures: Signature[] };

export function latestSignature(c: ClientWithSignatures): Signature | null {
  if (!c.signatures?.length) return null;
  const signed = c.signatures.find((s) => s.status === "ASSINADO");
  if (signed) return signed;
  return [...c.signatures].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: async (): Promise<ClientWithSignatures[]> => {
    const { data, error } = await supabase
      .from("clients")
      .select("*, signatures(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ClientWithSignatures[];
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async (): Promise<Settings> => {
    const { data, error } = await supabase.from("app_settings").select("*").eq("id", "default").single();
    if (error) throw error;
    return data;
  },
});
