import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/file')({
  server: { handlers: {
    GET: async ({ request }) => {
      if (!process.env['DATABASE_URL']) return new Response('Não disponível', { status: 404 });
      const { database } = await import('@/lib/vps/db.server');
      const { loadPrivate, validBucket, verifyPrivateUrl } = await import('@/lib/vps/files.server');
      const q = new URL(request.url).searchParams;
      const bucket = q.get('bucket') ?? '', path = q.get('path') ?? '', scope = q.get('scope') ?? '';
      const expires = Number(q.get('expires')), sig = q.get('sig') ?? '';
      if (!validBucket(bucket) || !/^[a-f0-9]{64}$/.test(scope)) return new Response('Não autorizado', { status: 403 });
      try {
        if (!verifyPrivateUrl(bucket, path, scope, expires, sig)) return new Response('Link expirado', { status: 403 });
        // Public links are limited to documents of this still-pending signature only.
        if (bucket !== 'documents') return new Response('Não autorizado', { status: 403 });
        const { rows } = await database().query(`SELECT d.content_type FROM signature_documents d JOIN signatures s ON s.id=d.signature_id
          WHERE d.storage_path=$1 AND s.token_hash=$2 AND s.status='PENDENTE' AND (s.expires_at IS NULL OR s.expires_at>now())`, [path, scope]);
        if (!rows[0]) return new Response('Não autorizado', { status: 403 });
        const bytes = await loadPrivate(bucket, path);
        return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': rows[0].content_type, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox' } });
      } catch { return new Response('Arquivo indisponível', { status: 404 }); }
    },
  } },
});
