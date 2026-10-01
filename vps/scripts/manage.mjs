import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const scrypt = promisify(scryptCallback);
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não configurada');
const db = new pg.Client({ connectionString: url });

async function passwordFromTty() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Execute em um terminal interativo para digitar a senha com segurança');
  process.stdout.write('Senha (mínimo 12 caracteres): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = '';
  try {
    return await new Promise((done, reject) => {
      const onData = (chunk) => {
        for (const c of chunk.toString('utf8')) {
          if (c === '\u0003') { process.stdin.off('data', onData); reject(new Error('Operação cancelada')); return; }
          if (c === '\r' || c === '\n') { process.stdin.off('data', onData); process.stdout.write('\n'); done(value); return; }
          if (c === '\u007f') value = value.slice(0, -1);
          else value += c;
        }
      };
      process.stdin.on('data', onData);
    });
  } finally { process.stdin.setRawMode(false); process.stdin.pause(); }
}

async function hashPassword(password) {
  if (password.length < 12 || password.length > 128) throw new Error('A senha deve ter de 12 a 128 caracteres');
  const salt = randomBytes(32);
  const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:32768:8:1:${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function main() {
  const [action, emailArg, nameArg] = process.argv.slice(2);
  if (!['migrate', 'create-admin', 'reset-password'].includes(action)) throw new Error('Uso: node vps/scripts/manage.mjs migrate | create-admin email nome | reset-password email');
  await db.connect();
  try {
    if (action === 'migrate') {
      await db.query('BEGIN');
      try {
        await db.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
        await db.query('GRANT SELECT, INSERT ON public.schema_migrations TO assinaturas_app');
        const version = '001_initial';
        const existing = await db.query('SELECT 1 FROM public.schema_migrations WHERE version = $1', [version]);
        if (!existing.rowCount) {
          await db.query(await readFile(resolve('vps/migrations/001_initial.sql'), 'utf8'));
          await db.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [version]);
        }
        await db.query('COMMIT');
        console.log(existing.rowCount ? 'Banco já atualizado.' : 'Estrutura inicial aplicada.');
      } catch (error) { await db.query('ROLLBACK'); throw error; }
      return;
    }
    const email = emailArg?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) throw new Error('Informe um e-mail válido');
    if (action === 'create-admin' && (!nameArg?.trim() || nameArg.length > 100)) throw new Error('Informe o nome do administrador');
    const passwordHash = await hashPassword(await passwordFromTty());
    await db.query('BEGIN');
    try {
      if (action === 'create-admin') {
        await db.query('LOCK TABLE public.user_roles IN EXCLUSIVE MODE');
        const admins = await db.query("SELECT 1 FROM public.user_roles WHERE role = 'admin' LIMIT 1");
        if (admins.rowCount) throw new Error('Já existe administrador. Use reset-password se necessário.');
        const { rows } = await db.query('INSERT INTO public.users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id', [nameArg.trim(), email, passwordHash]);
        await db.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')", [rows[0].id]);
      } else {
        const result = await db.query("UPDATE public.users SET password_hash = $1 WHERE email = $2 AND id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin') RETURNING id", [passwordHash, email]);
        if (!result.rowCount) throw new Error('Administrador não encontrado');
        await db.query('UPDATE public.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [result.rows[0].id]);
      }
      await db.query('COMMIT');
      console.log(action === 'create-admin' ? 'Administrador criado.' : 'Senha atualizada e sessões revogadas.');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
