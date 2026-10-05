import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { database, iso } from './db.server';
import { deletePrivate, privateUrl, savePrivate, type Bucket } from './files.server';
import { randomToken, sha256Hex } from '../crypto.server';
import { requireAdmin } from './auth.server';

function cipherKey() {
  const value = process.env['TOKEN_ENCRYPTION_KEY'];
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new Error('TOKEN_ENCRYPTION_KEY precisa ter 64 caracteres hexadecimais');
  return Buffer.from(value, 'hex');
}
function encrypt(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}
function decrypt(ciphertext: string) {
  const [iv, tag, bytes] = ciphertext.split(':');
  if (!iv || !tag || !bytes) throw new Error('Token inválido');
  const decipher = createDecipheriv('aes-256-gcm', cipherKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(Buffer.from(bytes, 'hex'), undefined, 'utf8') + decipher.final('utf8');
}
type JsonRow = Record<string, unknown>;

export async function listClients() {
  await requireAdmin();
  const { rows } = await database().query(`SELECT c.*,coalesce((SELECT json_agg(s ORDER BY s.created_at DESC) FROM
    (SELECT sig.*,coalesce((SELECT json_agg(d ORDER BY d.created_at,d.id) FROM signature_documents d WHERE d.signature_id=sig.id),'[]'::json) AS signature_documents
    FROM signatures sig WHERE sig.client_id=c.id) s),'[]'::json) AS signatures FROM clients c ORDER BY c.created_at DESC`);
  return rows.map((client: JsonRow) => {
    const signatures = Array.isArray(client['signatures']) ? client['signatures'] as JsonRow[] : [];
    return {
      ...client,
      created_at: iso(client['created_at'] as Date),
      updated_at: iso(client['updated_at'] as Date),
      signed_at: iso(client['signed_at'] as Date | null),
      signatures: signatures.map((signature) => {
        const documents = Array.isArray(signature['signature_documents']) ? signature['signature_documents'] as JsonRow[] : [];
        return {
          ...signature,
          token: decrypt(signature['token_ciphertext'] as string),
          created_at: iso(signature['created_at'] as Date),
          expires_at: iso(signature['expires_at'] as Date | null),
          signed_at: iso(signature['signed_at'] as Date | null),
          signature_documents: documents.map((document) => ({ ...document, created_at: iso(document['created_at'] as Date) })),
        };
      }),
    };
  });
}
export async function getSettings() {
  await requireAdmin();
  const { rows } = await database().query('SELECT * FROM app_settings WHERE id=$1', ['default']);
  return { ...rows[0], updated_at: iso(rows[0].updated_at) };
}
export async function saveClient(payload: Record<string, string | null>, id?: string) {
  const admin = await requireAdmin();
  const fields = ['codigo','tipo_pessoa','name','cpf','phone','rg','orgao_expedidor','apelido','endereco','complemento','bairro','cidade','uf','pais','cep','notes'];
  const values = fields.map(f => payload[f] ?? null);
  const { rows } = id ? await database().query(`UPDATE clients SET ${fields.map((f,i) => `${f}=$${i+1}`).join(',')} WHERE id=$17 RETURNING *`, [...values, id])
    : await database().query(`INSERT INTO clients(${fields.join(',')},created_by) VALUES(${fields.map((_,i) => `$${i+1}`).join(',')},$17) RETURNING *`, [...values, admin.id]);
  if (!rows[0]) throw new Error('Cliente não encontrado');
  await database().query('INSERT INTO audit_logs(action,entity,entity_id,actor_id) VALUES($1,$2,$3,$4)', [id ? 'client.updated' : 'client.created','client',rows[0].id,admin.id]);
  return { ...rows[0], created_at: iso(rows[0].created_at), updated_at: iso(rows[0].updated_at), signed_at: iso(rows[0].signed_at) };
}
export async function saveSettings(data: { company_name: string; logo_data: string | null; whatsapp_message: string; client_intro_text: string; link_expiry_days: number; privacy_text: string }) {
  await requireAdmin();
  await database().query(`UPDATE app_settings SET company_name=$1,logo_data=$2,whatsapp_message=$3,client_intro_text=$4,link_expiry_days=$5,privacy_text=$6 WHERE id='default'`, [data.company_name,data.logo_data,data.whatsapp_message,data.client_intro_text,data.link_expiry_days,data.privacy_text]);
}
export async function createLink(input: { clientId: string; title?: string; description?: string; requirePhoto?: boolean; documents?: {name: string;type: string;data: string}[] }, ip: string, ua: string) {
  const admin = await requireAdmin();
  const token = randomToken(32), hash = await sha256Hex(token), ciphertext = encrypt(token);
  const connection = await database().connect();
  const saved: string[] = [];
  try {
    await connection.query('BEGIN');
    const { rows: clients } = await connection.query('SELECT id FROM clients WHERE id=$1', [input.clientId]);
    if (!clients[0]) throw new Error('Cliente não encontrado');
    const { rows: settings } = await connection.query("SELECT link_expiry_days FROM app_settings WHERE id='default'");
    const days = settings[0]?.link_expiry_days ?? 0;
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    const { rows } = await connection.query(`INSERT INTO signatures(client_id,token_hash,token_ciphertext,title,description,require_photo,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [input.clientId,hash,ciphertext,input.title ?? 'Confirmação de assinatura',input.description || null,input.requirePhoto ?? true,expiresAt]);
    await connection.query("UPDATE clients SET status='PENDENTE' WHERE id=$1", [input.clientId]);
    for (const [index, doc] of (input.documents ?? []).entries()) {
      const match = doc.data.match(/^data:(application\/pdf|image\/jpeg|image\/png);base64,(.+)$/);
      if (!match?.[2] || match[1] !== doc.type) throw new Error(`Arquivo inválido: ${doc.name}`);
      const bytes = Buffer.from(match[2], 'base64');
      const valid = doc.type === 'application/pdf' ? bytes.subarray(0,5).toString() === '%PDF-' : doc.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      if (!valid || bytes.length < 1 || bytes.length > 10 * 1024 * 1024) throw new Error(`Conteúdo inválido: ${doc.name}`);
      const path = `${rows[0].id}/${index}-${doc.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)}`;
      await savePrivate('documents', path, bytes); saved.push(path);
      await connection.query('INSERT INTO signature_documents(signature_id,file_name,storage_path,content_type,file_size) VALUES($1,$2,$3,$4,$5)', [rows[0].id,doc.name,path,doc.type,bytes.length]);
    }
    await connection.query('INSERT INTO audit_logs(action,entity,entity_id,actor_id,ip_address,user_agent,details) VALUES($1,$2,$3,$4,$5,$6,$7)', ['link.generated','signature',rows[0].id,admin.id,ip,ua,JSON.stringify({ client_id: input.clientId })]);
    await connection.query('COMMIT');
    return { token, signatureId: rows[0].id as string, expiresAt };
  } catch (error) { await connection.query('ROLLBACK').catch(() => {}); await Promise.all(saved.map(path => deletePrivate('documents',path).catch(() => {}))); throw error; }
  finally { connection.release(); }
}
export async function importClientRows(rows: Record<string, string | null>[]) {
  const admin = await requireAdmin();
  const fields = ['codigo','tipo_pessoa','cpf','name','phone','rg','orgao_expedidor','apelido','endereco','complemento','bairro','cidade','uf','pais','cep','notes'];
  const connection = await database().connect();
  try {
    await connection.query('BEGIN');
    for (const row of rows) await connection.query(`INSERT INTO clients(${fields.join(',')},created_by) VALUES(${fields.map((_,i) => `$${i+1}`).join(',')},$17) ON CONFLICT(codigo) DO UPDATE SET ${fields.filter(f => f !== 'codigo').map(f => `${f}=EXCLUDED.${f}`).join(',')}`, [...fields.map(f => row[f] ?? null),admin.id]);
    await connection.query('COMMIT'); return { imported: rows.length };
  } catch (error) { await connection.query('ROLLBACK'); throw error; } finally { connection.release(); }
}
export async function fileLink(bucket: Bucket, path: string) {
  const admin = await requireAdmin();
  const table = bucket === 'documents' ? 'signature_documents' : bucket === 'photos' ? 'signatures' : 'signatures';
  const field = bucket === 'documents' ? 'storage_path' : bucket === 'photos' ? 'photo_path' : 'signature_path';
  const { rows } = await database().query(`SELECT 1 FROM ${table} WHERE ${field}=$1 UNION SELECT 1 FROM clients WHERE $2='photos' AND photo_path=$1`, [path,bucket]);
  if (!rows[0]) throw new Error('Arquivo indisponível');
  return { url: privateUrl(bucket,path,`admin:${admin.id}`) };
}
