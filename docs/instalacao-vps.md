# Instalação em VPS Ubuntu com PostgreSQL

Instalação limpa (sem migrar dados do Lovable Cloud), com Node.js + PM2, PostgreSQL local, arquivos privados em disco, Nginx e HTTPS. Somente administrador; sem cadastro público e sem e-mail — a senha é redefinida por comando no servidor.

> Teste primeiro em uma VPS de homologação com dados descartáveis (seção 8) antes de liberar aos clientes.

## 1. Requisitos

- Ubuntu 24.04 LTS, usuário com `sudo`, 2 vCPU e 2 GB de RAM (4 GB recomendados).
- Domínio com registro DNS `A` apontando para a VPS. A câmera do cliente **só funciona com HTTPS**.
- Node.js 22 LTS, Bun, PM2, PostgreSQL 16, Nginx, Certbot.
- Exemplos usam `assinaturas.example.com`, usuário de sistema `assinaturas` e banco `assinaturas`. Troque pelo seu.

## 2. Preparar o servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git nginx postgresql postgresql-contrib certbot python3-certbot-nginx ufw
sudo systemctl enable --now postgresql nginx
```

Instale Node.js 22 LTS (https://nodejs.org) e Bun (https://bun.sh/docs/installation); confira `node -v` e `bun -v`. Depois:

```bash
sudo npm install -g pm2
sudo useradd --system --create-home --home-dir /opt/assinaturas --shell /bin/bash assinaturas
sudo install -d -o assinaturas -g assinaturas -m 0750 /opt/assinaturas/app
sudo install -d -o assinaturas -g assinaturas -m 0700 /var/lib/assinaturas /var/lib/assinaturas/photos /var/lib/assinaturas/documents /var/lib/assinaturas/signature-marks
sudo install -d -o postgres -g postgres -m 0700 /var/backups/assinaturas

sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

Nunca abra as portas 3000 nem 5432 para a internet.

## 3. Banco de dados

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE assinaturas_app LOGIN PASSWORD 'SENHA_FORTE_GERADA_NA_VPS';
CREATE DATABASE assinaturas OWNER assinaturas_app ENCODING 'UTF8';
\c assinaturas
CREATE EXTENSION IF NOT EXISTS pgcrypto;
\q
```

O nome do papel precisa ser exatamente `assinaturas_app` (as migrações concedem permissões a ele). **Não** aplique `supabase/migrations` neste banco; use apenas `vps/migrations`.

## 4. Código e variáveis de ambiente

Copie o projeto (por exemplo, `git clone` do seu repositório GitHub privado) para `/opt/assinaturas/app`, sem `.env` nem `node_modules`:

```bash
sudo -u assinaturas git clone <URL_DO_SEU_REPOSITORIO> /opt/assinaturas/app
```

Gere os segredos **na VPS**:

```bash
openssl rand -hex 32   # use em TOKEN_ENCRYPTION_KEY (64 caracteres hexadecimais)
openssl rand -hex 32   # use em FILE_LINK_SECRET
```

Crie `/opt/assinaturas/app.env` (fora do repositório), dono `assinaturas`, modo `0600`:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATABASE_URL=postgresql://assinaturas_app:<senha-codificada-para-URL>@127.0.0.1:5432/assinaturas
PRIVATE_STORAGE_ROOT=/var/lib/assinaturas
TOKEN_ENCRYPTION_KEY=<64 hex>
FILE_LINK_SECRET=<64 hex>
```

```bash
sudo chown assinaturas:assinaturas /opt/assinaturas/app.env && sudo chmod 0600 /opt/assinaturas/app.env
```

Importante:
- `TOKEN_ENCRYPTION_KEY` protege os links gravados no banco. **Não troque depois** de gerar links, senão o painel não consegue mostrá-los. Inclua-o no backup seguro.
- `FILE_LINK_SECRET` assina os endereços temporários de fotos e documentos; trocar apenas invalida links abertos.
- O modo VPS é escolhido na compilação (`build:vps`). O servidor só usa PostgreSQL quando `DATABASE_URL` existe; as duas coisas precisam estar presentes.

## 5. Instalar, migrar, criar o administrador e compilar

Execute como o usuário `assinaturas`:

```bash
sudo -iu assinaturas
cd /opt/assinaturas/app
set -a; . /opt/assinaturas/app.env; set +a
bun install --frozen-lockfile
node vps/scripts/manage.mjs migrate
node vps/scripts/manage.mjs create-admin admin@seudominio.com "Nome do administrador"
bun run build:vps
```

- `migrate` aplica `001_initial` e `002_admin_login_attempts`, registra em `schema_migrations` e pode ser repetido com segurança.
- `create-admin` pede a senha no terminal (12 a 128 caracteres, `scrypt`); só funciona se ainda não houver administrador.
- `build:vps` gera o servidor Node em `.output/server/index.mjs`.

Teste local antes do PM2:

```bash
node .output/server/index.mjs &
curl -I http://127.0.0.1:3000/auth
kill %1
```

## 6. PM2

Crie `/opt/assinaturas/app/ecosystem.config.cjs` (ainda como `assinaturas`):

```js
module.exports = {
  apps: [{
    name: 'assinaturas',
    script: '.output/server/index.mjs',
    cwd: '/opt/assinaturas/app',
    node_args: '--env-file=/opt/assinaturas/app.env',
    instances: 1,
    max_memory_restart: '600M',
  }],
};
```

```bash
pm2 start ecosystem.config.cjs
pm2 save
exit
sudo env PATH="$PATH" pm2 startup systemd -u assinaturas --hp /opt/assinaturas
```

Execute o comando que o `pm2 startup` exibir. Use `sudo -iu assinaturas pm2 status` e `pm2 logs assinaturas`. Não rode a aplicação como root.

## 7. Nginx e HTTPS

`/etc/nginx/sites-available/assinaturas`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name assinaturas.example.com;

    client_max_body_size 150m; # até 10 documentos de 10 MB codificados

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

O cabeçalho `X-Real-IP` é obrigatório: ele registra o IP do cliente e alimenta o limite de tentativas de login e de assinatura.

```bash
sudo ln -s /etc/nginx/sites-available/assinaturas /etc/nginx/sites-enabled/assinaturas
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d assinaturas.example.com --redirect
sudo certbot renew --dry-run
```

O cookie de sessão é `Secure`: o login do painel só funciona por HTTPS.

## 8. Testes antes de liberar

1. Abrir `https://seu-dominio/auth`, entrar com o administrador; abrir `/dashboard` em janela anônima deve voltar para o login.
2. Cadastrar e editar um cliente; importar o CSV modelo em Configurações (não cria assinaturas).
3. Criar **duas solicitações para o mesmo cliente** com documentos diferentes e concluir cada link no celular (CPF/CNPJ, foto, assinatura à mão, consentimento).
4. Confirmar que cada solicitação mantém seus próprios documentos, foto, traço, data/hora e IP, e que a foto do cadastro continua sendo a da primeira assinatura.
5. Reabrir um link já usado: deve informar que já foi utilizado.
6. O painel atualiza a lista automaticamente a cada 10 segundos.
7. Alterar a senha em Configurações (sessões são encerradas) e testar `node vps/scripts/manage.mjs reset-password <email>`.
8. Após 10 senhas erradas em 15 minutos, o login fica bloqueado temporariamente para aquele IP.

## 9. Atualização

```bash
sudo -iu assinaturas
cd /opt/assinaturas/app
set -a; . /opt/assinaturas/app.env; set +a
git pull
bun install --frozen-lockfile
node vps/scripts/manage.mjs migrate
bun run build:vps
pm2 restart assinaturas
```

Faça backup antes de atualizar.

## 10. Backup e restauração

Banco, arquivos e o `app.env` precisam ser salvos juntos:

```bash
sudo -u postgres pg_dump -Fc -f /var/backups/assinaturas/banco-$(date +%F).dump assinaturas
sudo tar -C /var/lib -czf /var/backups/assinaturas/arquivos-$(date +%F).tar.gz assinaturas
sudo cp /opt/assinaturas/app.env /var/backups/assinaturas/app-$(date +%F).env
sudo chmod 0600 /var/backups/assinaturas/*
```

Os backups contêm CPF, fotos e assinaturas: criptografe e guarde uma cópia **fora da VPS**.

Restauração (com a aplicação parada: `pm2 stop assinaturas`): recrie o banco vazio com dono `assinaturas_app`, rode `sudo -u postgres pg_restore --no-owner --role=assinaturas_app -d assinaturas <arquivo.dump>`, extraia os arquivos com `sudo tar -C /var/lib -xzf <arquivo.tar.gz>`, corrija o dono com `sudo chown -R assinaturas:assinaturas /var/lib/assinaturas`, restaure o mesmo `TOKEN_ENCRYPTION_KEY` e inicie o PM2.

## 11. Problemas comuns

- **502 Bad Gateway:** `pm2 status` / `pm2 logs assinaturas`; confirme `curl -I http://127.0.0.1:3000/auth`.
- **Login não mantém a sessão:** acesse por HTTPS (cookie `Secure`).
- **Painel não abre os links ou dá erro de token:** `TOKEN_ENCRYPTION_KEY` diferente do usado ao gerar os links.
- **Fotos/documentos não abrem:** `PRIVATE_STORAGE_ROOT`, permissões de `/var/lib/assinaturas` e `FILE_LINK_SECRET`.
- **413 Request Entity Too Large:** aumente `client_max_body_size`.
- **Câmera não abre:** HTTPS válido, permissão no navegador e abrir fora do navegador interno do WhatsApp.
- **Banco indisponível:** `systemctl status postgresql`, `DATABASE_URL` e senha codificada na URL.
