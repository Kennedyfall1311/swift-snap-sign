import { createServerFn } from "@tanstack/react-start";

/** Safe public subset of the company settings (name, logo, privacy text). */
export const getPublicSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("company_name, logo_data, privacy_text")
    .eq("id", "default")
    .maybeSingle();
  return {
    companyName: data?.company_name ?? "Verifica",
    logoData: data?.logo_data ?? null,
    privacyText: data?.privacy_text ?? "",
  };
});

/** Controls whether the one-time administrator registration is still available. */
export const getRegistrationAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) return { registrationOpen: false };
  return { registrationOpen: (count ?? 0) === 0 };
});
