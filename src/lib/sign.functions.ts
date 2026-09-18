import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { isValidCPF, onlyDigits } from "./format";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MIN_PHOTO_BYTES = 2 * 1024;
const RATE_WINDOW_MIN = 15;
const RATE_LIMIT = 12;

function clientMeta() {
  const req = getRequest();
  const h = req.headers;
  const ip =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "desconhecido";
  const ua = (h.get("user-agent") || "").slice(0, 500);
  return { ip, ua };
}

async function checkRateLimit(admin: any, ip: string) {
  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
  const { count } = await admin
    .from("sign_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);
  return (count ?? 0) < RATE_LIMIT;
}

export type SignLinkInfo =
  | { ok: true; clientName: string; companyName: string; logoData: string | null; introText: string; privacyText: string }
  | { ok: false; reason: "invalid" | "used" | "expired" | "cancelled" | "rate_limited" };

export const getSignLinkInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(d))
  .handler(async ({ data }): Promise<SignLinkInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256Hex } = await import("./crypto.server");
    const { ip } = clientMeta();
    if (!(await checkRateLimit(supabaseAdmin, ip))) return { ok: false, reason: "rate_limited" };

    const tokenHash = await sha256Hex(data.token);
    const { data: sig } = await supabaseAdmin
      .from("signatures")
      .select("id, status, expires_at, client_id, clients(name, status)")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!sig) {
      await supabaseAdmin.from("sign_attempts").insert({ ip_address: ip, token_hash: tokenHash, success: false });
      return { ok: false, reason: "invalid" };
    }
    if (sig.status === "ASSINADO") return { ok: false, reason: "used" };
    if (sig.status === "CANCELADO") return { ok: false, reason: "cancelled" };
    if (sig.expires_at && new Date(sig.expires_at) < new Date()) return { ok: false, reason: "expired" };

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("company_name, logo_data, client_intro_text, privacy_text")
      .eq("id", "default")
      .single();

    const client = sig.clients as unknown as { name: string } | null;
    return {
      ok: true,
      clientName: client?.name ?? "",
      companyName: settings?.company_name ?? "",
      logoData: settings?.logo_data ?? null,
      introText: settings?.client_intro_text ?? "",
      privacyText: settings?.privacy_text ?? "",
    };
  });

const submitSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(3).max(120),
  cpf: z.string().trim().min(11).max(14),
  photo: z.string().startsWith("data:image/jpeg;base64,").max(MAX_PHOTO_BYTES * 1.4),
  consent: z.literal(true),
});

export type SubmitResult =
  | { ok: true; signatureId: string; signedAt: string }
  | { ok: false; error: string };

export const submitSignature = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }): Promise<SubmitResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256Hex } = await import("./crypto.server");
    const { ip, ua } = clientMeta();

    if (!(await checkRateLimit(supabaseAdmin, ip))) {
      return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    }
    const tokenHash = await sha256Hex(data.token);
    const logAttempt = (success: boolean) =>
      supabaseAdmin.from("sign_attempts").insert({ ip_address: ip, token_hash: tokenHash, success });

    if (!isValidCPF(data.cpf)) {
      await logAttempt(false);
      return { ok: false, error: "CPF inválido." };
    }

    // Validate image payload
    const base64 = data.photo.slice("data:image/jpeg;base64,".length);
    let bytes: Buffer;
    try {
      bytes = Buffer.from(base64, "base64");
    } catch {
      return { ok: false, error: "Foto inválida." };
    }
    if (bytes.length < MIN_PHOTO_BYTES || bytes.length > MAX_PHOTO_BYTES) {
      return { ok: false, error: "Tamanho da foto inválido." };
    }
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
      await logAttempt(false);
      return { ok: false, error: "Formato de imagem não suportado." };
    }

    const { data: sig } = await supabaseAdmin
      .from("signatures")
      .select("id, status, expires_at, client_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!sig) {
      await logAttempt(false);
      return { ok: false, error: "Link inválido." };
    }
    if (sig.status !== "PENDENTE") return { ok: false, error: "Este link já foi utilizado." };
    if (sig.expires_at && new Date(sig.expires_at) < new Date()) {
      return { ok: false, error: "Este link expirou. Solicite um novo link." };
    }

    const photoPath = `${sig.client_id}/${sig.id}.jpg`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("photos")
      .upload(photoPath, bytes, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      console.error("photo upload failed", upErr);
      return { ok: false, error: "Não foi possível salvar a foto. Tente novamente." };
    }

    const signedAt = new Date().toISOString();
    // One-time use: only flips if still PENDENTE
    const { data: updated } = await supabaseAdmin
      .from("signatures")
      .update({
        status: "ASSINADO",
        signer_name: data.name,
        signer_cpf: onlyDigits(data.cpf),
        photo_path: photoPath,
        signed_at: signedAt,
        ip_address: ip,
        user_agent: ua,
      })
      .eq("id", sig.id)
      .eq("status", "PENDENTE")
      .select("id")
      .maybeSingle();

    if (!updated) return { ok: false, error: "Este link já foi utilizado." };

    await supabaseAdmin
      .from("clients")
      .update({ status: "ASSINADO", signed_at: signedAt })
      .eq("id", sig.client_id);

    await Promise.all([
      logAttempt(true),
      supabaseAdmin.from("audit_logs").insert({
        action: "signature.confirmed",
        entity: "signature",
        entity_id: sig.id,
        ip_address: ip,
        user_agent: ua,
        details: { client_id: sig.client_id },
      }),
    ]);

    return { ok: true, signatureId: sig.id, signedAt };
  });
