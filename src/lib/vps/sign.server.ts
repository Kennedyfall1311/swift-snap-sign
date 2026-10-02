import { database, iso } from './db.server';
import { deletePrivate, privateUrl, savePrivate } from './files.server';
import { sha256Hex } from '../crypto.server';
import { isValidDocument, onlyDigits } from '../format';

const fail = (error: string) => ({ ok: false as const, error });
async function rateAllowed(ip: string) {
  const result = await database().query('SELECT count(*)::int AS count FROM sign_attempts WHERE ip_address=$1 AND created_at > now() - interval \'15 minutes\'', [ip]);
  return result.rows[0].count < 12;
}
async function record(ip: string, tokenHash: string, success: boolean) {
  await database().query('INSERT INTO sign_attempts(ip_address,token_hash,success) VALUES($1,$2,$3)', [ip, tokenHash, success]);
}
async function lookup(hash: string) {
  const result = await database().query(`SELECT s.*, c.name AS client_name, c.tipo_pessoa, d.id AS document_id
    FROM signatures s JOIN clients c ON c.id=s.client_id
    LEFT JOIN LATERAL (SELECT id FROM signature_documents WHERE signature_id=s.id LIMIT 1) d ON true
    WHERE s.token_hash=$1`, [hash]);
  return result.rows[0];
}
export async function localSignInfo(token: string, ip: string) {
  if (!(await rateAllowed(ip))) return { ok: false as const, reason: 'rate_limited' as const };
  const hash = await sha256Hex(token);
  const sig = await lookup(hash);
  if (!sig) { await record(ip, hash, false); return { ok: false as const, reason: 'invalid' as const }; }
  if (sig.status === 'ASSINADO') return { ok: false as const, reason: 'used' as const };
  if (sig.status === 'CANCELADO') return { ok: false as const, reason: 'cancelled' as const };
  if (sig.expires_at && new Date(sig.expires_at) < new Date()) return { ok: false as const, reason: 'expired' as const };
  const [settings, docs] = await Promise.all([
    database().query('SELECT company_name,logo_data,client_intro_text,privacy_text FROM app_settings WHERE id=$1', ['default']),
    database().query('SELECT file_name,storage_path,content_type FROM signature_documents WHERE signature_id=$1 ORDER BY created_at,id', [sig.id]),
  ]);
  const s = settings.rows[0];
  return { ok: true as const, clientName: sig.client_name as string, personType: sig.tipo_pessoa as string, title: sig.title as string, description: sig.description as string | null, requirePhoto: sig.require_photo as boolean,
    documents: docs.rows.map(d => ({ name: d.file_name as string, type: d.content_type as string, url: privateUrl('documents', d.storage_path, hash, 600) })),
    companyName: s?.company_name ?? '', logoData: s?.logo_data ?? null, introText: s?.client_intro_text ?? '', privacyText: s?.privacy_text ?? '' };
}
export async function localSubmit(input: { token: string; name: string; document: string; photo: string | null; signature: string }, ip: string, ua: string) {
  if (!(await rateAllowed(ip))) return fail('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  const hash = await sha256Hex(input.token);
  const sig = await lookup(hash);
  if (!sig) { await record(ip, hash, false); return fail('Link inválido.'); }
  if (sig.status !== 'PENDENTE') return fail('Este link já foi utilizado.');
  if (sig.expires_at && new Date(sig.expires_at) < new Date()) return fail('Este link expirou. Solicite um novo link.');
  if (!isValidDocument(input.document, sig.tipo_pessoa)) { await record(ip, hash, false); return fail(`${sig.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'} inválido.`); }
  if (sig.require_photo && !input.photo) return fail('A foto é obrigatória nesta assinatura.');
  let photo: Buffer | null = null;
  if (input.photo) {
    photo = Buffer.from(input.photo.slice('data:image/jpeg;base64,'.length), 'base64');
    if (photo.length < 2048 || photo.length > 2 * 1024 * 1024 || photo[0] !== 0xff || photo[1] !== 0xd8 || photo[2] !== 0xff) return fail('Foto inválida.');
  }
  const mark = Buffer.from(input.signature.slice('data:image/png;base64,'.length), 'base64');
  if (mark.length < 200 || mark.length > 2 * 1024 * 1024 || !mark.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return fail('Assinatura manual inválida.');
  const photoPath = photo ? `${sig.client_id}/${sig.id}.jpg` : null;
  const markPath = `${sig.client_id}/${sig.id}.png`;
  const connection = await database().connect();
  let committed = false;
  try {
    await connection.query('BEGIN');
    const locked = await connection.query('SELECT status,expires_at FROM signatures WHERE id=$1 FOR UPDATE', [sig.id]);
    if (locked.rows[0]?.status !== 'PENDENTE') { await connection.query('ROLLBACK'); return fail('Este link já foi utilizado.'); }
    if (locked.rows[0]?.expires_at && new Date(locked.rows[0].expires_at) < new Date()) { await connection.query('ROLLBACK'); return fail('Este link expirou. Solicite um novo link.'); }
    if (photo && photoPath) await savePrivate('photos', photoPath, photo);
    await savePrivate('signature-marks', markPath, mark);
    const updated = await connection.query(`UPDATE signatures SET status='ASSINADO',signer_name=$2,signer_cpf=$3,signer_document=$3,photo_path=$4,signature_path=$5,signed_at=now(),ip_address=$6,user_agent=$7 WHERE id=$1 AND status='PENDENTE' RETURNING signed_at`, [sig.id, input.name, onlyDigits(input.document), photoPath, markPath, ip, ua]);
    await connection.query("UPDATE clients SET status='ASSINADO',signed_at=$2,photo_path=COALESCE(photo_path,$3) WHERE id=$1", [sig.client_id, updated.rows[0].signed_at, photoPath]);
    await connection.query('INSERT INTO sign_attempts(ip_address,token_hash,success) VALUES($1,$2,true)', [ip, hash]);
    await connection.query("INSERT INTO audit_logs(action,entity,entity_id,ip_address,user_agent,details) VALUES('signature.confirmed','signature',$1,$2,$3,$4)", [sig.id, ip, ua, JSON.stringify({ client_id: sig.client_id })]);
    await connection.query('COMMIT'); committed = true;
    return { ok: true as const, signatureId: sig.id as string, signedAt: iso(updated.rows[0].signed_at) ?? new Date().toISOString() };
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => {});
    if (!committed) { if (photoPath) await deletePrivate('photos', photoPath).catch(() => {}); await deletePrivate('signature-marks', markPath).catch(() => {}); }
    console.error('Falha ao registrar assinatura', error);
    return fail('Não foi possível concluir a assinatura. Tente novamente.');
  } finally { connection.release(); }
}
