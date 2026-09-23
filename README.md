# Crie uma aplicação web completa de gerenciamento de assinaturas digitais, simples, rápida e...

Crie uma aplicação web completa de gerenciamento de assinaturas digitais, simples, rápida e responsiva, com foco principal em uso pelo celular.

O sistema será utilizado por uma empresa para cadastrar clientes e gerar um link individual de assinatura. O cliente receberá esse link pelo WhatsApp e deverá realizar uma confirmação simples através de nome, CPF e uma foto tirada pela câmera do celular.

OBJETIVO PRINCIPAL

O fluxo deve ser extremamente simples:

ADMINISTRADOR:

Faz login no sistema.

Cadastra um cliente.

Informa nome, CPF, telefone e, opcionalmente, observação.

Clica em "Gerar link de assinatura".

O sistema cria um link único para aquele cliente.

O administrador pode copiar o link ou abrir o WhatsApp para enviá-lo.

Quando o cliente concluir a assinatura, o status muda automaticamente para "ASSINADO".

O administrador consegue visualizar o nome, CPF, data/hora da assinatura e a foto capturada pelo cliente.

CLIENTE:

Abre o link recebido.

Visualiza uma página extremamente simples.

Confirma o nome.

Informa o CPF.

Tira uma foto utilizando a câmera do celular.

Visualiza a foto.

Pode tirar novamente caso não tenha ficado boa.

Clica em "CONFIRMAR ASSINATURA".

O sistema registra a assinatura.

Mostra uma mensagem de sucesso.

Não criar cadastro ou login para o cliente.

PAINEL ADMINISTRATIVO

Criar um dashboard moderno, limpo e simples.

Menu lateral:

Dashboard

Assinaturas

Clientes

Configurações

DASHBOARD

Mostrar cards:

Total de clientes

Aguardando assinatura

Assinados

Assinaturas realizadas hoje

Abaixo dos cards, mostrar uma lista das assinaturas mais recentes.

Cada registro deve mostrar:

Nome

CPF

Status

Data da assinatura

Foto, quando assinada

Ações

Usar indicadores visuais claros:

PENDENTE = amarelo
ASSINADO = verde
CANCELADO = vermelho

CLIENTES

Criar uma tela para gerenciamento dos clientes.

Tabela:

Nome | CPF | Telefone | Status | Data | Ações

Permitir:

Novo cliente

Editar cliente

Visualizar cliente

Gerar link

Copiar link

Enviar pelo WhatsApp

Visualizar assinatura

Ao cadastrar:

Nome completo
CPF
Telefone
Observação opcional

O CPF deve ser formatado automaticamente.

GERAR LINK

Depois de cadastrar o cliente, criar um link único de assinatura.

Exemplo:

https://seudominio.com/assinar/8f72a9c31b...

O token deve ser aleatório, seguro e impossível de adivinhar facilmente.

O administrador deve ter os botões:

[ COPIAR LINK ]

[ ENVIAR PELO WHATSAPP ]

Ao clicar em WhatsApp, abrir o WhatsApp com uma mensagem semelhante a:

"Olá, [NOME]. Para concluir seu cadastro, acesse o link abaixo e realize sua assinatura:

[LINK]"

Permitir editar essa mensagem nas configurações.

PÁGINA DO CLIENTE

Esta é a parte mais importante do sistema.

A página precisa ser extremamente simples e funcionar muito bem no celular.

Não exigir login.

Layout:

LOGO DA EMPRESA

"Confirmação de Assinatura"

Texto curto:

"Para concluir, informe seus dados e tire uma foto."

Campo:

Nome completo

Campo:

CPF

Depois:

"Foto"

Mostrar um botão grande:

📷 TIRAR FOTO

Ao clicar, solicitar acesso à câmera do celular.

Preferencialmente utilizar a câmera frontal.

Depois da captura:

Mostrar a foto capturada.

Botões:

[ TIRAR NOVAMENTE ]

[ CONFIRMAR ASSINATURA ]

Antes da confirmação:

☐ Confirmo que os dados informados são meus e autorizo o registro desta assinatura e fotografia para fins de identificação e comprovação.

O botão "CONFIRMAR ASSINATURA" só deve ficar disponível quando:

Nome estiver preenchido

CPF válido estiver preenchido

Foto tiver sido capturada

Checkbox estiver marcado

IMPORTANTE SOBRE A FOTO

A foto deve ser capturada diretamente pela câmera do dispositivo sempre que possível.

No celular:

Solicitar permissão para usar a câmera.

Abrir a câmera frontal.

Permitir tirar a foto.

Mostrar preview.

Permitir tirar novamente.

No desktop, permitir utilizar a webcam ou selecionar uma imagem como alternativa.

Comprimir a imagem antes de enviar para reduzir o tamanho do arquivo, mantendo qualidade suficiente para identificação.

FINALIZAÇÃO

Quando o cliente clicar em "CONFIRMAR ASSINATURA":

Enviar para o backend:

ID do cliente

Nome

CPF

Foto

Data/hora

IP

User-Agent

Token utilizado

Registrar a assinatura no banco de dados.

Alterar o status do cliente para:

ASSINADO

Mostrar:

"Assinatura realizada com sucesso!"

"Obrigado, seus dados foram registrados."

Não permitir que o mesmo link seja utilizado novamente depois da assinatura.

PAINEL DE ASSINATURAS

Criar uma página específica para gerenciamento das assinaturas.

Filtros:

Todas

Pendentes

Assinadas

Canceladas

Pesquisa por:

Nome

CPF

Telefone

Cada assinatura deve mostrar:

Nome
CPF
Foto
Status
Data/hora
IP
Link de assinatura
Observação

Ao clicar em "Visualizar", abrir uma página/modal contendo:

FOTO DO CLIENTE

Nome completo
CPF
Data e hora da assinatura
IP
Identificador da assinatura

Mostrar claramente:

✓ ASSINATURA CONFIRMADA

BANCO DE DADOS

Utilizar PostgreSQL.

Criar uma estrutura organizada.

Tabela users:

id
name
email
password_hash
created_at
updated_at

Tabela clients:

id
name
cpf
phone
notes
status
created_at
updated_at

Tabela signatures:

id
client_id
token_hash
photo_path
signed_at
ip_address
user_agent
status
created_at

Cada cliente deve possuir seu próprio link/token de assinatura.

Nunca armazenar senha em texto puro.

ARMAZENAMENTO DE FOTOS

Não armazenar a imagem diretamente no PostgreSQL.

Salvar os arquivos em storage no servidor/VPS.

Estrutura:

/storage/photos/
/storage/documents/

No PostgreSQL armazenar apenas o caminho seguro do arquivo.

As fotos não devem ficar disponíveis publicamente através de uma URL simples.

O backend deve verificar a autenticação do administrador antes de entregar a foto.

SEGURANÇA

Implementar:

HTTPS

Senhas com hash seguro

JWT ou sessão segura para administrador

Tokens de assinatura criptograficamente seguros

Expiração opcional dos links

Token de uso único

Validação de CPF

Limite de tentativas

Proteção contra upload de arquivos maliciosos

Validação do tipo e tamanho da imagem

Controle de acesso às fotos

Logs de auditoria

Registro de IP

Registro de data/hora

Proteção contra SQL Injection

Proteção contra XSS

Proteção contra CSRF quando aplicável

DESIGN

O sistema deve ter aparência profissional, mas sem excesso de elementos.

Prioridade:

Simplicidade

Velocidade

Facilidade de uso

Responsividade

Visual profissional

Utilizar:

React

TypeScript

Tailwind CSS

Componentes modernos

Ícones Lucide

PostgreSQL

Backend Node.js

A interface administrativa deve funcionar muito bem em computador e celular.

A página de assinatura do cliente deve ser otimizada principalmente para celular.

RESPONSIVIDADE

No celular:

A página deve ocupar toda a tela.

Campos grandes e fáceis de tocar.

Botão de câmera grande.

Botão de confirmação grande.

Evitar menus e informações desnecessárias.

O cliente deve conseguir concluir todo o processo em menos de 1 minuto.

STATUS

Utilizar:

PENDENTE
ASSINADO
CANCELADO

Fluxo:

CLIENTE CADASTRADO
↓
PENDENTE
↓
LINK GERADO
↓
CLIENTE ABRE LINK
↓
PREENCHE NOME + CPF
↓
TIRA FOTO
↓
CONFIRMA
↓
ASSINADO

NOTIFICAÇÃO NO PAINEL

Quando um cliente assinar, o painel deve atualizar o status automaticamente sem precisar atualizar manualmente a página.

Se possível, utilizar WebSocket ou Supabase Realtime para atualizar o dashboard em tempo real.

Exemplo:

Antes:

🟡 JOÃO DA SILVA
Pendente

Depois que o cliente assinar:

🟢 JOÃO DA SILVA
Assinado
18/09/2026 15:32

O administrador deve conseguir visualizar a foto imediatamente.

CONFIGURAÇÕES

Criar uma página de configurações para:

Nome da empresa

Logo

Mensagem enviada pelo WhatsApp

Texto apresentado ao cliente

Prazo padrão do link

Configurações de privacidade

Alteração de senha do administrador

PRIVACIDADE

Como o sistema armazenará CPF e fotografia, tratar esses dados como informações pessoais.

Criar uma política de privacidade básica no sistema e deixar a arquitetura preparada para adequação à LGPD.

O cliente deve visualizar uma informação clara sobre a finalidade da coleta da foto e dos dados.

IMPORTANTE

Não transformar o projeto em uma plataforma complexa de assinatura de contratos.

O objetivo NÃO é criar DocuSign.

É criar um sistema simples de:

CADASTRAR CLIENTE → GERAR LINK → CLIENTE TIRA FOTO + INFORMA CPF/NOME → CONFIRMA → ADMINISTRADOR VISUALIZA.

A experiência do cliente deve ser extremamente rápida.

Priorizar a experiência mobile.

Criar também uma tela de login administrativa e proteger todas as rotas do painel.

Preparar o projeto para posteriormente ser hospedado em uma VPS Ubuntu com PostgreSQL, Nginx e PM2.

Criar migrations/schema do PostgreSQL, backend, frontend e todas as APIs necessárias.

Entregar o sistema funcional de ponta a ponta, não apenas telas estáticas.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://swift-snap-sign.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/abe3862f-8a4b-4a95-a8d2-30a7b20b36e5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
