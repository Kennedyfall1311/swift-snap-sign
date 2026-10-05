import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server';
import { getRequest } from '@tanstack/react-start/server';
import { database } from './db.server';

const COOKIE = 'verifica_vps_session';
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export async function verifyPassword(password: string, stored: string) {
  const [algo, N, r, p, salt, expected] = stored.split(':');
  if (algo !== 'scrypt' || N !== '32768' || r !== '8' || p !== '1' || !salt || !expected || !/^[a-f0-9]{64}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expected)) return false;
  const actual = await deriveKey(password, Buffer.from(salt, 'hex'));
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128) throw new Error('A senha deve ter de 12 a 128 caracteres');
  const salt = randomBytes(32);
  const hash = await deriveKey(password, salt);
  return `scrypt:32768:8:1:${salt.toString('hex')}:${hash.toString('hex')}`;
}
export async function currentAdmin() {
  const token = getCookie(COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await database().query(`SELECT u.id,u.email,u.name FROM sessions s
    JOIN users u ON u.id=s.user_id JOIN user_roles r ON r.user_id=u.id AND r.role='admin'
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now()`, [tokenHash(token)]);
  return (rows[0] ?? null) as { id: string; email: string; name: string } | null;
}
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new Error('Acesso negado');
  return admin;
}
export async function login(email: string, password: string) {
  const request = getRequest();
  const ip = (request.headers.get('x-real-ip') || 'unknown').slice(0, 100);
  const identity = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const attempts = await database().query("SELECT count(*)::int AS count FROM admin_login_attempts WHERE ip_address=$1 AND created_at > now() - interval '15 minutes'", [ip]);
  if (attempts.rows[0].count >= 10) return false;
  const { rows } = await database().query(`SELECT u.id,u.password_hash FROM users u JOIN user_roles r ON r.user_id=u.id AND r.role='admin' WHERE lower(u.email)=lower($1)`, [email]);
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
    await database().query('INSERT INTO admin_login_attempts(ip_address,email_hash) VALUES($1,$2)', [ip, identity]);
    return false;
  }
  const token = randomBytes(32).toString('hex');
  await database().query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')", [rows[0].id, tokenHash(token)]);
  setCookie(COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });
  return true;
}
export async function logout() {
  const token = getCookie(COOKIE);
  if (token) await database().query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1', [tokenHash(token)]);
  deleteCookie(COOKIE, { path: '/' });
}
