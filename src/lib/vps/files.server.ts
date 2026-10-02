import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export type Bucket = 'documents' | 'photos' | 'signature-marks';
const buckets: Bucket[] = ['documents', 'photos', 'signature-marks'];

function root() {
  const storage = process.env['PRIVATE_STORAGE_ROOT'];
  if (!storage) throw new Error('PRIVATE_STORAGE_ROOT não configurado');
  return resolve(storage);
}
function secret() {
  const value = process.env['FILE_LINK_SECRET'];
  if (!value || value.length < 32) throw new Error('FILE_LINK_SECRET precisa ter ao menos 32 caracteres');
  return value;
}
export function privatePath(bucket: Bucket, path: string) {
  if (!buckets.includes(bucket) || !/^[a-zA-Z0-9._/-]{1,300}$/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Caminho inválido');
  const parent = join(root(), bucket);
  const target = resolve(parent, path);
  if (!target.startsWith(parent + sep)) throw new Error('Caminho inválido');
  return target;
}
export async function savePrivate(bucket: Bucket, path: string, bytes: Buffer) {
  const target = privatePath(bucket, path);
  await mkdir(resolve(target, '..'), { recursive: true, mode: 0o700 });
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    const handle = await open(tmp, 'wx', 0o600);
    try { await handle.writeFile(bytes); } finally { await handle.close(); }
    await rename(tmp, target);
  } catch (error) { await rm(tmp, { force: true }); throw error; }
}
export async function deletePrivate(bucket: Bucket, path: string) { await rm(privatePath(bucket, path), { force: true }); }
export async function loadPrivate(bucket: Bucket, path: string) { return readFile(privatePath(bucket, path)); }
function signature(bucket: Bucket, path: string, expires: number, scope: string) {
  return createHmac('sha256', secret()).update(`${bucket}\n${path}\n${expires}\n${scope}`).digest('hex');
}
export function privateUrl(bucket: Bucket, path: string, scope: string, seconds = 600) {
  privatePath(bucket, path);
  const expires = Math.floor(Date.now() / 1000) + seconds;
  const query = new URLSearchParams({ bucket, path, scope, expires: String(expires), sig: signature(bucket, path, expires, scope) });
  return `/api/public/file?${query}`;
}
export function verifyPrivateUrl(bucket: Bucket, path: string, scope: string, expires: number, sig: string) {
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + 1200 || !/^[a-f0-9]{64}$/.test(sig)) return false;
  privatePath(bucket, path);
  return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(signature(bucket, path, expires, scope), 'hex'));
}
export function validBucket(value: string): value is Bucket { return buckets.includes(value as Bucket); }
