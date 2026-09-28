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

function hasExpectedFileSignature(bytes: Buffer, type: "application/pdf" | "image/jpeg" | "image/png") {
  if (type === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

/** Creates an independent signature request for a client. Returns its unique token. */
export const generateSignLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), regenerate: z.boolean().optional(), title: z.string().trim().min(3).max(160).optional(), description: z.string().trim().max(1000).optional(), requirePhoto: z.boolean().optional(), documents: z.array(z.object({ name: z.string().min(1).max(180), type: z.enum(["application/pdf", "image/jpeg", "image/png"]), data: z.string().max(14_000_000) })).max(10).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;
    const { randomToken, sha256Hex } = await import("./crypto.server");

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
      .insert({ client_id: data.clientId, token, token_hash: tokenHash, expires_at: expiresAt, title: data.title ?? "Confirmação de assinatura", description: data.description || null, require_photo: data.requirePhoto ?? true })
      .select("id")
      .single();
    if (error || !created) throw new Error("Não foi possível gerar o link");

    if (data.documents?.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const rows = [];
      for (const [index, doc] of data.documents.entries()) {
        const match = doc.data.match(/^data:(application\/pdf|image\/jpeg|image\/png);base64,(.+)$/);
        if (!match?.[2]) throw new Error(`Arquivo inválido: ${doc.name}`);
        const bytes = Buffer.from(match[2], "base64");
        if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error(`Arquivo fora do limite: ${doc.name}`);
        if (!hasExpectedFileSignature(bytes, doc.type)) throw new Error(`Conteúdo inválido: ${doc.name}`);
        const safeName = doc.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
        const path = `${created.id}/${index}-${safeName}`;
        const { error: uploadError } = await supabaseAdmin.storage.from("documents").upload(path, bytes, { contentType: doc.type, upsert: false });
        if (uploadError) throw new Error(`Não foi possível anexar ${doc.name}`);
        rows.push({ signature_id: created.id, file_name: doc.name, storage_path: path, content_type: doc.type, file_size: bytes.length });
      }
      const { error: docsError } = await supabase.from("signature_documents").insert(rows);
      if (docsError) throw new Error("Não foi possível registrar os documentos");
    }

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

export const importClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(z.object({ codigo: z.string().trim().min(1).max(40), tipo_pessoa: z.enum(["PF", "PJ"]), cpf: z.string().min(11).max(14), name: z.string().trim().min(3).max(120), phone: z.string().max(15), rg: z.string().max(30).nullable(), orgao_expedidor: z.string().max(30).nullable(), apelido: z.string().max(120).nullable(), endereco: z.string().max(180).nullable(), complemento: z.string().max(100).nullable(), bairro: z.string().max(100).nullable(), cidade: z.string().max(100).nullable(), uf: z.string().max(2).nullable(), pais: z.string().max(60), cep: z.string().max(8).nullable(), notes: z.string().max(500).nullable() })).min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const rows = data.rows.map((row) => ({ ...row, created_by: context.userId }));
    const { error } = await context.supabase.from("clients").upsert(rows, { onConflict: "codigo" });
    if (error) throw new Error("Não foi possível importar os clientes");
    return { imported: rows.length };
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

export const getPrivateFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bucket: z.enum(["photos", "documents", "signature-marks"]), path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.path.includes("..")) throw new Error("Caminho inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from(data.bucket).createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error("Arquivo indisponível");
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
