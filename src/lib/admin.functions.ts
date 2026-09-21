import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado");
}

function reqMeta() {
  const h = getRequest().headers;
  return {
    ip: h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    ua: (h.get("user-agent") || "").slice(0, 500),
  };
}

/** Creates (or returns the active) signature link for a client. Returns the plain token. */
export const generateSignLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), regenerate: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;
    const { randomToken, sha256Hex } = await import("./crypto.server");

    const { data: existing } = await supabase
      .from("signatures")
      .select("id, token, status, expires_at")
      .eq("client_id", data.clientId)
      .eq("status", "PENDENTE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const notExpired = existing && (!existing.expires_at || new Date(existing.expires_at) > new Date());
    if (existing && notExpired && !data.regenerate) {
      return { token: existing.token, signatureId: existing.id, expiresAt: existing.expires_at };
    }
    if (existing) {
      await supabase.from("signatures").update({ status: "CANCELADO" }).eq("id", existing.id);
    }

    const { data: settings } = await supabase
      .from("app_settings")
      .select("link_expiry_days")
      .eq("id", "default")
      .single();
    const days = settings?.link_expiry_days ?? 0;
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;

    const token = randomToken(32);
    const tokenHash = await sha256Hex(token);
    const { data: created, error } = await supabase
      .from("signatures")
      .insert({ client_id: data.clientId, token, token_hash: tokenHash, expires_at: expiresAt })
      .select("id")
      .single();
    if (error || !created) throw new Error("Não foi possível gerar o link");

    await supabase.from("clients").update({ status: "PENDENTE", signed_at: null }).eq("id", data.clientId);

    const meta = reqMeta();
    await supabase.from("audit_logs").insert({
      action: "link.generated",
      entity: "signature",
      entity_id: created.id,
      actor_id: userId,
      ip_address: meta.ip,
      user_agent: meta.ua,
      details: { client_id: data.clientId },
    });

    return { token, signatureId: created.id, expiresAt };
  });

/** Returns a short-lived private URL for a captured photo. Admin only. */
export const getPhotoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.path.includes("..")) throw new Error("Caminho inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("photos")
      .createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error("Foto indisponível");
    return { url: signed.signedUrl };
  });

export const logAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        action: z.string().max(80),
        entity: z.string().max(40).optional(),
        entityId: z.string().uuid().optional(),
        details: z.record(z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const meta = reqMeta();
    await context.supabase.from("audit_logs").insert({
      action: data.action,
      entity: data.entity ?? null,
      entity_id: data.entityId ?? null,
      actor_id: context.userId,
      ip_address: meta.ip,
      user_agent: meta.ua,
      details: data.details ?? null,
    });
    return { ok: true };
  });
