# Ajustes da área de Clientes

## O que será alterado

- Deixar a página **Clientes** dedicada somente ao cadastro: remover filtros, status, datas e ações ligadas às assinaturas.
- Manter pesquisa própria por código, CPF/CNPJ, nome e telefone.
- Exibir na lista apenas dados cadastrais e as ações de visualizar/editar o cliente.
- Ao editar um cliente, mostrar sua foto cadastrada; a foto capturada na primeira assinatura preencherá esse cadastro.
- Preservar a primeira foto do cliente, sem substituí-la automaticamente em assinaturas posteriores.
- Corrigir a estrutura lateral para eliminar o corte e a faixa branca em zoom de 100%, incluindo larguras menores.
- Validar a página em computador e celular.

## Detalhes técnicos

- Separar a apresentação de clientes da apresentação de solicitações, sem remover o histórico de assinaturas da área **Assinaturas**.
- Usar o campo privado de foto já existente no cadastro e abrir sua imagem por acesso temporário protegido.
- Ajustar a atualização da foto para ocorrer apenas quando o cliente ainda não possuir uma.
- Tornar a estrutura principal alinhada à borda da janela e impedir transbordamento horizontal.
