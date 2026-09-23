# Port completo para VPS com PostgreSQL

## Objetivo
Transformar a aplicação atual em uma instalação autônoma para Ubuntu, sem depender do Lovable Cloud em produção. A instalação será nativa, executada pelo PM2, com PostgreSQL local, Nginx e HTTPS.

## O que será construído

1. **Servidor e banco autônomos**
   - Trocar o acesso atual ao banco por consultas PostgreSQL executadas exclusivamente no servidor.
   - Criar um schema de instalação limpa com usuários, funções, clientes, solicitações, anexos, configurações, auditoria e tentativas.
   - Manter as regras de código único, múltiplas solicitações, link de uso único e preservação da primeira foto.

2. **Login administrativo próprio**
   - Substituir o login atual por sessões seguras em cookie `HttpOnly`, `Secure` e `SameSite`.
   - Armazenar senhas somente com hash forte.
   - Remover cadastro público; criar o primeiro administrador por comando executado na VPS.
   - Manter login, logout, proteção das páginas e alteração de senha atual.
   - A recuperação de senha será feita por comando administrativo seguro, sem SMTP.

3. **Arquivos privados**
   - Armazenar documentos, fotos e assinaturas em diretórios fora da pasta pública.
   - Validar formato, assinatura binária, tamanho e caminhos.
   - Servir arquivos somente por endereço temporário assinado; documentos da solicitação continuam acessíveis ao cliente enquanto o link estiver válido.

4. **Atualização do painel**
   - Substituir a atualização em tempo real atual por eventos enviados pelo próprio servidor.
   - Manter a atualização automática das listas e o aviso quando uma assinatura for concluída.

5. **Aplicação preparada para PM2**
   - Gerar a aplicação como servidor Node compatível com Ubuntu.
   - Adicionar configuração do PM2, exemplo seguro de variáveis e comandos administrativos.
   - Adicionar verificações de saúde e encerramento seguro das conexões.

6. **Instalador e operação**
   - Criar scripts idempotentes para instalar PostgreSQL, Nginx, Node/Bun, PM2, banco, pastas e permissões.
   - Incluir configuração de domínio e certificado HTTPS com Certbot.
   - Criar comandos para atualização, backup, restauração e redefinição de senha.

7. **Tutorial em português**
   - Documentar requisitos, DNS, instalação limpa, criação do administrador, publicação, firewall, HTTPS e testes.
   - Documentar rotina de atualização, backup do banco e dos arquivos, restauração e solução de problemas.
   - Destacar que a câmera exige HTTPS e que os dados atuais do Lovable Cloud não serão migrados nesta modalidade.

## Detalhes técnicos
- Runtime: Node.js LTS com PM2.
- Banco: PostgreSQL 16 local, acessível apenas pela aplicação e pelo servidor.
- Proxy: Nginx com limites adequados aos anexos e suporte a eventos em tempo real.
- Sessão: identificador aleatório em cookie; apenas o hash fica no PostgreSQL; expiração e revogação no logout/troca de senha.
- Senhas: `scrypt` com salt individual.
- Proteções: CSRF de mesma origem, validação Zod, consultas parametrizadas, limitação de tentativas, cabeçalhos de segurança e arquivos privados.

## Validação
- Executar as verificações automatizadas do projeto.
- Testar login, cadastro/edição de cliente, criação de link, leitura de documento, foto, assinatura manual, conclusão e visualização administrativa.
- Conferir as configurações de PM2/Nginx e os scripts em uma instalação limpa reproduzível.
