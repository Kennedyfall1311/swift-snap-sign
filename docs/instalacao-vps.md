# Instalação em VPS Ubuntu — guia de operação

> **Situação em 01/10/2026:** a estrutura inicial do PostgreSQL, os comandos administrativos e o destino Node para compilações externas foram preparados. **A instalação autônoma ainda não está pronta**: as consultas, o login, os arquivos e os avisos no painel continuam ligados ao Lovable Cloud. Não execute `pm2 start` esperando uma instalação funcional com PostgreSQL local. Este guia não migra os dados existentes; a instalação prevista é limpa.

## 1. Arquitetura prevista e requisitos

- VPS Ubuntu **24.04 LTS**, usuário com `sudo`, ao menos 2 vCPU, 2 GB de RAM (4 GB recomendados) e espaço para os anexos e backups.
- Domínio próprio com registro DNS `A` apontando para o IP público da VPS; registro `AAAA` apenas se IPv6 estiver configurado.
- Node.js **24 LTS**, PM2, PostgreSQL **16** local, Nginx e Certbot.
- Aplicação em `/opt/assinaturas/app`, arquivos privados em `/var/lib/assinaturas/{photos,documents,signature-marks}`, backups em `/var/backups/assinaturas`.
- Nginx recebe o tráfego público nas portas 80/443 e encaminha para a aplicação escutando **somente** em `127.0.0.1:3000`. PostgreSQL escuta somente em localhost. A câmera do cliente exige HTTPS.
- Os exemplos usam `assinaturas.example.com`, o usuário de sistema `assinaturas` e o banco `assinaturas`. Troque o domínio pelo seu **antes** de executar comandos com ele. Não reutilize senhas de exemplo.

## 2. Preparar o Ubuntu

Acesse a VPS como um usuário com `sudo` e atualize o sistema:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git nginx postgresql postgresql-contrib certbot python3-certbot-nginx ufw
sudo systemctl enable --now postgresql nginx
```

Ubuntu 24.04 fornece PostgreSQL 16. Confira com `psql --version`; se a versão for diferente, use o repositório oficial PostgreSQL antes de criar o banco. Instale Node.js 24 LTS de uma fonte oficial e confira `node --version` e `npm --version`. Para preservar o `bun.lock` atual, instale também Bun conforme as instruções oficiais em <https://bun.sh/docs/installation> e confira `bun --version`. Faça download e revise os instaladores antes de executá-los na VPS.

Crie uma conta sem privilégios para a aplicação e os diretórios privados:

```bash
sudo useradd --system --create-home --home-dir /opt/assinaturas --shell /usr/sbin/nologin assinaturas
sudo install -d -o assinaturas -g assinaturas -m 0750 /opt/assinaturas/app
sudo install -d -o assinaturas -g assinaturas -m 0700 /var/lib/assinaturas/photos /var/lib/assinaturas/documents /var/lib/assinaturas/signature-marks
sudo install -d -o postgres -g postgres -m 0700 /var/backups/assinaturas
sudo npm install -g pm2
```

Configure firewall **depois** de verificar que o acesso SSH usa a porta 22 (ajuste caso contrário):

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Não abra as portas 3000 nem 5432 para a internet. Faça atualizações de segurança regulares e mantenha uma forma de acesso de emergência à VPS.

## 3. Criar um banco local vazio

Gere uma senha aleatória **na VPS** e guarde-a em um gerenciador de senhas. Não coloque a senha em histórico do shell, repositório ou capturas de tela. Para criar o papel e banco, entre no console local:

```bash
sudo -u postgres psql
```

No prompt `postgres=#` (substitua a senha gerada):

```sql
CREATE ROLE assinaturas_app LOGIN PASSWORD 'SENHA_FORTE_GERADA_LOCALMENTE';
CREATE DATABASE assinaturas OWNER assinaturas_app ENCODING 'UTF8';
\q
```

Confirme que `listen_addresses` no PostgreSQL não expõe a porta publicamente (`SHOW listen_addresses;`); o valor `localhost` é adequado. A aplicação futura deve usar uma URL local como `postgresql://assinaturas_app:<senha-codificada-para-URL>@127.0.0.1:5432/assinaturas`. Caracteres especiais da senha precisam ser codificados na URL. **Ainda não aplique as migrations em `supabase/migrations` neste banco:** elas dependem de esquemas/serviços específicos do Lovable Cloud e não constituem o schema autônomo da VPS.

O projeto agora inclui `vps/migrations/001_initial.sql`, específico para instalação limpa. Após obter o código na VPS e instalar as dependências, o comando abaixo pode criar a estrutura inicial. **Isto prepara apenas o banco — não instala o aplicativo funcional.** Execute como o dono do banco, em um terminal cujo ambiente contenha `DATABASE_URL`; não coloque a senha diretamente no comando nem em um arquivo do repositório.

```bash
node vps/scripts/manage.mjs migrate
```

O comando registra a versão aplicada em `schema_migrations` e não repete a migração se for executado novamente. Ele exige um papel PostgreSQL chamado `assinaturas_app`, como criado acima. O banco contém `users`, `user_roles` separados, `sessions`, `clients`, `signatures`, `signature_documents`, `app_settings`, `audit_logs` e `sign_attempts`. **Não há restrição de uma assinatura por cliente**; documentos pertencem a cada solicitação. Dados e anexos do Lovable Cloud não são importados por este comando.

Depois de aplicar a migração, estes comandos locais criam o primeiro administrador ou redefinem sua senha sem enviar e-mail; solicitam a senha no terminal, sem recebê-la como argumento de linha de comando:

```bash
node vps/scripts/manage.mjs create-admin admin@seudominio.com "Nome do administrador"
node vps/scripts/manage.mjs reset-password admin@seudominio.com
```

A senha tem de 12 a 128 caracteres e é armazenada com `scrypt` e sal individual. A redefinição revoga as sessões existentes. **A tela de login ainda não usa essas contas; os comandos não habilitam o acesso ao aplicativo até a adaptação restante ser concluída.**

## 4. DNS, Nginx e HTTPS

Depois de apontar o registro DNS para a VPS, confirme com `dig +short assinaturas.example.com` (instale `dnsutils` se necessário). Crie `/etc/nginx/sites-available/assinaturas` com o conteúdo abaixo, substituindo o domínio:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name assinaturas.example.com;

    client_max_body_size 110m; # até dez documentos de 10 MB mais formulário/codificação

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off; # necessário para eventos enviados pelo servidor (SSE)
        proxy_read_timeout 1h;
    }
}
```

O valor de `client_max_body_size` precisa acompanhar os limites efetivos definidos pelo port; Nginx e aplicação devem impor limites. Ative o site e teste a sintaxe:

```bash
sudo ln -s /etc/nginx/sites-available/assinaturas /etc/nginx/sites-enabled/assinaturas
sudo nginx -t && sudo systemctl reload nginx
```

**Após a aplicação funcionar localmente**, emita o certificado e ative redirecionamento para HTTPS:

```bash
sudo certbot --nginx -d assinaturas.example.com --redirect
sudo certbot renew --dry-run
```

Confira `https://assinaturas.example.com` no navegador. Não use câmera nem publique links de assinatura antes de HTTPS estar funcionando. Certbot precisa das portas 80/443 abertas e do DNS propagado. Não use o domínio de prévia do Lovable como substituto do seu domínio.

## 5. O que falta implementar no código antes de iniciar a aplicação

O repositório **ainda não oferece** estes elementos para VPS autônoma:

1. O destino de compilação Node foi configurado para builds externos (`.output/server/index.mjs` é a entrada prevista do Nitro); falta validar a compilação e a execução completa fora do ambiente gerenciado e preparar o PM2.
2. O schema PostgreSQL independente e o comando de migração estão disponíveis em `vps/`; falta conectar o aplicativo a esse banco. Cada solicitação terá seu próprio registro e seus próprios arquivos — novas assinaturas nunca sobrescrevem as antigas.
3. Acesso ao PostgreSQL exclusivamente no servidor, com consultas parametrizadas, transações para uso único do token, expiração, auditoria e prevenção de tentativas excessivas.
4. Os comandos para criar o primeiro administrador e redefinir senha **sem SMTP** já existem; falta conectar as telas e funções a login próprio sem cadastro público, sessão revogável em cookie `HttpOnly; Secure; SameSite`.
5. Gravação privada de documentos, fotos e assinaturas manuscritas nos diretórios acima, validação do conteúdo e tamanho, URLs temporárias assinadas após validação da solicitação ativa e acesso administrativo autorizado. A primeira foto do cliente deve ser preservada.
6. Substituição do Realtime por eventos do próprio servidor e do fluxo atual de upload e URLs temporárias. O painel deve atualizar listas e avisar quando uma solicitação for assinada.
7. Arquivo de configuração do PM2, configuração de ambiente de produção, health check e encerramento limpo do servidor e das conexões de banco.

Essas partes **não são configuráveis apenas com Nginx ou com uma variável de ambiente**. A chave pública existente do Lovable Cloud não converte o projeto atual em uma instalação PostgreSQL local; uma chave administrativa também não é solução para isso. Nunca copie `.env` do projeto atual para a VPS nem exponha credenciais no frontend.

## 6. Publicar a versão autônoma (somente após concluir o port)

Publique o código revisado em um repositório privado. Para uma instalação limpa, copie o projeto para `/opt/assinaturas/app` com permissões do usuário `assinaturas`, sem `.env`, `node_modules`, backups ou arquivos de usuários. Instale as dependências reproduzivelmente com `bun install --frozen-lockfile` e compile com `bun run build` **somente depois** que a configuração do port gerar um servidor Node. Rode migrations específicas da versão VPS, em ordem, antes do primeiro acesso.

O port deve incluir um exemplo de ambiente (sem segredos) e documentação para estas variáveis, ou equivalentes:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
PUBLIC_ORIGIN=https://assinaturas.example.com
DATABASE_URL=postgresql://assinaturas_app:<senha-codificada>@127.0.0.1:5432/assinaturas
PRIVATE_STORAGE_ROOT=/var/lib/assinaturas
```

Crie o arquivo real de segredos **fora do repositório**, com dono `assinaturas` e modo `0600`; não comite nem imprima seu conteúdo. Se o port introduzir um segredo para assinar links de arquivo, gere-o aleatoriamente na VPS, armazene-o nesse arquivo e documente a rotação (links existentes podem expirar ao girá-lo).

O comando PM2 só pode ser fixado após verificar o caminho de saída do build Node do port. O formato esperado é:

```bash
# Exemplo estrutural; NÃO é um comando validado para o código atual.
sudo -u assinaturas pm2 start <CAMINHO_REAL_DA_ENTRADA_NODE> --name assinaturas
sudo -u assinaturas pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u assinaturas --hp /opt/assinaturas
```

Execute a instrução que `pm2 startup` devolver caso seja solicitada. Use `pm2 status` e `pm2 logs assinaturas` para inspecionar. Não execute PM2 como root para a aplicação. Crie o primeiro administrador com o comando administrativo que o port **ainda precisa fornecer**; não reabra cadastro público nem insira senhas em texto puro via SQL.

## 7. Testar antes de liberar aos usuários

No servidor, confirme que a aplicação responde em localhost (`curl -I http://127.0.0.1:3000/`), que a página HTTPS abre sem alerta, e que o navegador não tenta chamar URLs do Lovable Cloud. Execute estes testes completos com dados descartáveis:

1. Entrar com o primeiro administrador e confirmar que uma visita sem sessão não abre o painel.
2. Criar e editar um cliente; importar CSV de clientes; verificar que a importação não cria assinatura.
3. Criar duas solicitações para **o mesmo cliente**, com documentos diferentes; concluir cada uma pelo próprio link no celular.
4. Abrir e ler os documentos, informar CPF/CNPJ, capturar foto quando exigida, assinar manualmente e aceitar o consentimento.
5. Confirmar que cada solicitação preservou seus próprios documentos, foto, traço, data/hora, IP e status; o segundo envio não alterou o primeiro, e a foto inicial do cadastro permaneceu.
6. Tentar reutilizar um link concluído ou expirado; ambos devem falhar. Confirmar que um visitante sem autorização não acessa arquivos privados.
7. Confirmar aviso no painel, câmera frontal em Chrome Android/Safari iPhone, download de anexos, logout, redefinição de senha por comando e ausência de erros nos logs.

## 8. Atualização, backup e restauração

**Atualização:** faça backup antes; copie uma versão revisada do código; instale dependências com lockfile; compile; aplique somente migrations novas; reinicie (`sudo -u assinaturas pm2 restart assinaturas`); confirme a página HTTPS e os fluxos. Para alterações de schema, planeje rollback a partir do backup — não dependa apenas de voltar o código. Mantenha as versões de Node e PostgreSQL compatíveis com o port.

**Backup:** é obrigatório salvar **banco e arquivos privados juntos**, na mesma janela de manutenção, para não ter registros sem anexos. Exemplo de backup manual, após pausar envios ou colocar a aplicação em manutenção:

```bash
sudo -u postgres pg_dump -Fc -f /var/backups/assinaturas/assinaturas-AAAA-MM-DD.dump assinaturas
sudo tar -C /var/lib -czf /var/backups/assinaturas/arquivos-AAAA-MM-DD.tar.gz assinaturas
sudo sha256sum /var/backups/assinaturas/assinaturas-AAAA-MM-DD.dump /var/backups/assinaturas/arquivos-AAAA-MM-DD.tar.gz
```

Substitua `AAAA-MM-DD` pela data desejada. O arquivo de backup contém CPF, imagens e assinaturas: restrinja permissões (`chmod 0600`), criptografe antes de enviar para local externo e teste restaurações periodicamente. Ajuste permissões para que o operador autorizado consiga criar o TAR sem deixá-lo público. Garanta retenção e cópia **fora da VPS**: um disco perdido destrói aplicação e backup local ao mesmo tempo.

**Restauração:** interrompa a aplicação, preserve o estado atual para investigação, recrie um banco vazio com o dono correto e restaure com `pg_restore --no-owner --role=assinaturas_app --dbname=assinaturas <arquivo.dump>` usando um usuário PostgreSQL autorizado. Extraia o TAR em `/var/lib` com `tar -C /var/lib -xzf <arquivo.tar.gz>` após inspecionar seu conteúdo, ajuste dono/permissões dos arquivos para `assinaturas`, reinicie o PM2 e repita os testes do item 7. Faça primeiro uma restauração de ensaio em ambiente isolado. **Nunca restaure por cima de uma instalação ativa com usuários assinando.**

## 9. Diagnóstico rápido

- **502 Bad Gateway:** aplicação não iniciou ou não escuta em `127.0.0.1:3000`; confira `pm2 status`, logs e `curl` local.
- **Câmera não abre:** confirme HTTPS válido, permissão no navegador e abertura fora do navegador incorporado de aplicativos de mensagens.
- **413 Request Entity Too Large:** reveja `client_max_body_size` e os limites do app; não remova a validação de tamanho.
- **Banco indisponível:** confira `systemctl status postgresql`, URL local, permissão do papel e espaço em disco. Não abra 5432 publicamente.
- **Arquivo não abre:** confira permissões dos diretórios privados, validade do link temporário e status da solicitação.
- **Certificado:** confira DNS, portas 80/443 e `certbot renew --dry-run`.

**Próxima entrega necessária:** implementar e validar a integração com banco, autenticação e arquivos privados listada no item 5. Só então estes passos viram uma instalação executável de ponta a ponta.