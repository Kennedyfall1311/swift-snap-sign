# Central de assinaturas com documentos e assinatura manual

## Objetivo
Transformar **Assinaturas** no local onde o administrador prepara e envia uma solicitação completa: escolhe o cliente, anexa os documentos, define se haverá foto e gera o link. O cadastro de clientes passa a ser independente desse processo.

## O que será alterado

### 1. Cadastro completo de clientes
- Adicionar: código, tipo de pessoa (Física/Jurídica), CPF ou CNPJ, RG, órgão expedidor, nome/razão social, apelido/nome fantasia, endereço, complemento, bairro, cidade, UF, país e CEP.
- Manter telefone e observação para contato e contexto administrativo.
- Validar e formatar CPF/CNPJ e CEP conforme o tipo de pessoa.
- Remover a abertura automática do gerador de link após cadastrar um cliente.
- Atualizar listagem, pesquisa e visualização para os novos dados.

### 2. Importação de clientes
- Adicionar em **Configurações** uma área para importar arquivo CSV.
- Disponibilizar modelo CSV com os cabeçalhos aceitos.
- Validar as linhas antes de gravar, informar erros e apresentar resumo de importados/ignorados.
- Usar o código como identificador para atualizar cadastros existentes sem duplicá-los.

### 3. Novo fluxo em Assinaturas
- Adicionar botão **Nova assinatura**.
- Permitir localizar o cliente por código, CPF ou CNPJ.
- Permitir informar título/descrição da solicitação, anexar um ou mais documentos e definir se a foto será obrigatória.
- Aceitar PDF e imagens, com limites de formato e tamanho.
- Criar a solicitação e somente então gerar os botões de copiar link e enviar por WhatsApp.
- A listagem continuará mostrando pendentes, assinadas e canceladas, agora por solicitação/documento.

### 4. Experiência do cliente
- Mostrar claramente o nome e os documentos incluídos na solicitação.
- Permitir abrir/visualizar cada documento antes da confirmação.
- Solicitar CPF ou CNPJ de acordo com o cadastro.
- Exibir captura de foto somente quando configurada; ao concluir, salvar essa foto também como foto atual do cliente.
- Adicionar área de assinatura manual por toque, com limpar/refazer e validação para impedir assinatura vazia.
- Exigir aceite, documento de identificação válido e assinatura manual antes de confirmar.

### 5. Segurança e armazenamento
- Manter documentos, fotos e assinaturas manuscritas em armazenamento privado.
- Entregar documentos ao cliente apenas por link temporário validado pela solicitação ativa.
- Validar formato, tamanho e conteúdo básico dos arquivos no servidor.
- Registrar no comprovante a assinatura manual, foto quando aplicável, documentos vinculados, data/hora, IP e navegador.
- Preservar uso único, expiração, auditoria e controle administrativo já existentes.

## Detalhes técnicos
- Ampliar a tabela de clientes e separar o status de cada solicitação do cadastro do cliente.
- Adicionar dados da solicitação às assinaturas e uma tabela para seus documentos.
- Criar armazenamento privado para documentos e assinaturas manuscritas, com regras restritas.
- Atualizar as funções protegidas de criação/importação e as funções públicas do link.
- Atualizar tipos, consultas, telas administrativas, página pública e modais de comprovante.
- Validar em desktop e celular: importação CSV, criação do link, visualização dos anexos, foto opcional e desenho da assinatura.

## Premissas adotadas
- A importação será por CSV, formato mais simples e confiável para cadastros em lote.
- Cada solicitação poderá ter vários documentos.
- A foto será uma opção marcada pelo administrador em cada nova assinatura.
- A assinatura manual será obrigatória em toda solicitação.
