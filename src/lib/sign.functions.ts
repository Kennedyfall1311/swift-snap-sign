import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { onlyDigits } from "./format";

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
  | { ok: true; clientName: string; personType: string; title: string; description: string | null; requirePhoto: boolean; documents: { name: string; url: string; type: string }[]; companyName: string; logoData: string | null; introText: string; privacyText: string }
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
      .select("id, status, expires_at, client_id, title, description, require_photo, clients(name, status, tipo_pessoa), signature_documents(file_name, storage_path, content_type)")
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

    const client = sig.clients as unknown as { name: string; tipo_pessoa: string } | null;
    const docs = (sig.signature_documents ?? []) as unknown as { file_name: string; storage_path: string; content_type: string }[];
    const documents = await Promise.all(docs.map(async (doc) => {
      const { data: signed } = await supabaseAdmin.storage.from("documents").createSignedUrl(doc.storage_path, 60 * 20);
      return { name: doc.file_name, type: doc.content_type, url: signed?.signedUrl ?? "" };
    }));
    return {
      ok: true,
      clientName: client?.name ?? "",
      personType: client?.tipo_pessoa ?? "PF",
      title: sig.title,
      description: sig.description,
      requirePhoto: sig.require_photo,
      documents: documents.filter((d) => d.url),
      companyName: settings?.company_name ?? "",
      logoData: settings?.logo_data ?? null,
      introText: settings?.client_intro_text ?? "",
      privacyText: settings?.privacy_text ?? "",
    };
  });

const submitSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(3).max(120),
  document: z.string().trim().min(11).max(18),
  photo: z.string().startsWith("data:image/jpeg;base64,").max(MAX_PHOTO_BYTES * 1.4).nullable(),
  signature: z.string().startsWith("data:image/png;base64,").max(MAX_PHOTO_BYTES * 1.4),
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

    const { data: sig } = await supabaseAdmin
      .from("signatures")
      .select("id, status, expires_at, client_id, require_photo, clients(tipo_pessoa)")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    const personType = (sig?.clients as unknown as { tipo_pessoa: string } | null)?.tipo_pessoa ?? "PF";
    const { isValidDocument } = await import("./format");
    if (!isValidDocument(data.document, personType)) {
      await logAttempt(false);
      return { ok: false, error: `${personType === "PJ" ? "CNPJ" : "CPF"} inválido.` };
    }

    if (!sig) {
      await logAttempt(false);
      return { ok: false, error: "Link inválido." };
    }
    if (sig.status !== "PENDENTE") return { ok: false, error: "Este link já foi utilizado." };
    if (sig.expires_at && new Date(sig.expires_at) < new Date()) {
      return { ok: false, error: "Este link expirou. Solicite um novo link." };
    }

    if (sig.require_photo && !data.photo) return { ok: false, error: "A foto é obrigatória nesta assinatura." };
    let photoPath: string | null = null;
    if (data.photo) {
      const bytes = Buffer.from(data.photo.slice("data:image/jpeg;base64,".length), "base64");
      if (bytes.length < MIN_PHOTO_BYTES || bytes.length > MAX_PHOTO_BYTES || !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return { ok: false, error: "Foto inválida." };
      photoPath = `${sig.client_id}/${sig.id}.jpg`;
      const { error: upErr } = await supabaseAdmin.storage.from("photos").upload(photoPath, bytes, { contentType: "image/jpeg", upsert: true });
      if (upErr) return { ok: false, error: "Não foi possível salvar a foto. Tente novamente." };
    }
    const signatureBytes = Buffer.from(data.signature.slice("data:image/png;base64,".length), "base64");
    if (signatureBytes.length < 200 || signatureBytes.length > MAX_PHOTO_BYTES || signatureBytes[0] !== 0x89 || signatureBytes[1] !== 0x50) return { ok: false, error: "Assinatura manual inválida." };
    const signaturePath = `${sig.client_id}/${sig.id}.png`;
    const { error: signatureError } = await supabaseAdmin.storage.from("signature-marks").upload(signaturePath, signatureBytes, { contentType: "image/png", upsert: true });
    if (signatureError) return { ok: false, error: "Não foi possível salvar a assinatura manual." };

    const signedAt = new Date().toISOString();
    // One-time use: only flips if still PENDENTE
    const { data: updated } = await supabaseAdmin
      .from("signatures")
      .update({
        status: "ASSINADO",
        signer_name: data.name,
        signer_cpf: onlyDigits(data.document),
        signer_document: onlyDigits(data.document),
        photo_path: photoPath,
        signature_path: signaturePath,
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

    if (photoPath) {
      await supabaseAdmin
        .from("clients")
        .update({ photo_path: photoPath })
        .eq("id", sig.client_id)
        .is("photo_path", null);
    }

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
