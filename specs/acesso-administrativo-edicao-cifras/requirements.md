# Spec: acesso administrativo e edição de cifras

## Estado

**Rascunho refinado com o usuário:** a autorização deve persistir até sair ou
expirar; o acesso pela rede deve continuar usando somente HTTP; novas tentativas
após senha incorreta são permitidas; a edição deve cobrir todas as páginas
individuais de cifras servidas pelo projeto. A autorização expira após 30
minutos sem atividade administrativa e deve haver uma ação explícita para sair.

## Contexto

O servidor local do projeto já autentica operações de escrita. No modo de rede
local, a página de configurações atualmente solicita a senha por um prompt do
navegador quando uma operação protegida é iniciada. O usuário relata que a tela
de configurações abre neste PC, mas não em outro dispositivo, que apresenta
`ERR_SSL_PROTOCOL_ERROR`. Também relata que as opções de edição não aparecem
nas páginas individuais das cifras.

O servidor está sendo executado no celular, conectado ao PC por depuração USB.
O endereço informado no dispositivo com falha foi
`http://192.168.100.101:8000/configuracoes.html`, que já usa HTTP. Portanto,
`ERR_SSL_PROTOCOL_ERROR` não deve ser atribuído automaticamente a um endereço
HTTPS digitado incorretamente; é necessário diagnosticar se a porta está
servindo HTTP, se o navegador está atualizando a conexão para HTTPS ou se há
outro problema de acesso.

## Objetivo

Permitir que o usuário informe a senha administrativa diretamente na página de
configurações e, se ela for válida, use as operações CRUD disponíveis tanto ali
quanto nas páginas individuais das cifras, sem precisar informar a senha
novamente durante o período de autorização definido nesta spec.

## Requisitos funcionais

### RF-01 — Campo de senha na página de configurações

1. A página de configurações deve apresentar um campo para inserir a senha
   administrativa e uma ação explícita para validá-la.
2. O campo e o feedback de validação devem estar na própria página; não se deve
   usar prompt ou modal para solicitar a senha.
3. Antes da validação bem-sucedida, a página permanece em modo de leitura: os
   controles de criação, edição e exclusão não ficam disponíveis.
4. Se a senha estiver errada, ausente ou inválida, o usuário permanece sem
   acesso administrativo, vê uma mensagem clara na página e continua podendo
   consultar o conteúdo de leitura.
5. A senha deve ser tratada como dado sensível: não pode ser incluída em URLs,
   logs ou mensagens de erro.

### RF-02 — Autorização administrativa nas páginas individuais

1. Após a validação bem-sucedida, os controles de edição devem aparecer em todas
   as páginas individuais de cifras servidas pelo projeto.
2. A autorização deve continuar válida ao navegar entre as configurações e
   todas as páginas individuais, sem solicitar a senha novamente até que o
   usuário saia ou a autorização expire.
3. Sem autorização válida, as páginas individuais continuam disponíveis para
   leitura, mas não permitem editar ou salvar alterações.
4. O comportamento deve ser consistente ao abrir uma página individual por um
   link do repertório ou diretamente no navegador.
5. A interface deve oferecer uma ação explícita para encerrar a autorização e
   voltar imediatamente ao modo de leitura.
6. A autorização deve expirar após 30 minutos sem atividade administrativa; ao
   expirar, as páginas permanecem legíveis, mas as ações CRUD exigem nova
   validação da senha.

### RF-03 — Proteção das operações de escrita

1. A interface não deve ser a única barreira: o servidor deve continuar
   verificando a autorização em todas as operações de escrita e administração.
2. Uma tentativa de escrita sem autorização válida ou com senha inválida deve
   ser recusada pelo servidor, sem alterar arquivos.
3. Uma falha de autorização deve ser apresentada ao usuário sem apagar ou
   substituir conteúdo não salvo.
4. O fluxo de autorização não deve enfraquecer a autenticação existente do
   servidor nem afetar o modo local já suportado.

### RF-04 — Acesso por outros dispositivos

1. A tela de configurações e as páginas de cifras devem abrir em dispositivos
   autorizados a acessar o servidor pela rede configurada.
2. A mensagem `ERR_SSL_PROTOCOL_ERROR` deve ser investigada para distinguir
   erro de esquema/protocolo (HTTP versus HTTPS) de erro de conectividade ou
   indisponibilidade do servidor.
3. O endereço indicado ao usuário deve especificar o protocolo suportado; a
   implementação não deve apresentar HTTP como se fosse HTTPS.
4. O acesso na rede local deve usar HTTP; HTTPS não é requisito desta mudança.
   O endereço servido deve ser identificado corretamente como HTTP.

## Critérios de aceitação

1. Ao abrir configurações sem autorização, o usuário vê o campo de senha na
   página e não vê controles CRUD habilitados.
2. Informar uma senha incorreta mantém a página em modo de leitura e apresenta
   feedback de erro sem abrir prompt ou modal.
3. Informar a senha correta libera os controles administrativos da página de
   configurações.
4. Após a autorização, abrir uma página individual de cifra mostra as opções
   de edição e permite salvar uma alteração autorizada sem pedir a senha outra
   vez, até a saída explícita ou 30 minutos sem atividade administrativa.
5. Abrir uma página individual sem autorização permite leitura, mas não exibe
   controles administrativos e chamadas diretas de escrita sem autorização são
   recusadas pelo servidor.
6. O acesso de leitura aos dispositivos da rede e o modo local existente
   continuam funcionando.
7. Um teste manual documentado reproduz o acesso a partir do segundo dispositivo
   usando HTTP e esclarece a causa ou o tratamento esperado para
   `ERR_SSL_PROTOCOL_ERROR`.
8. O botão de saída encerra o acesso administrativo imediatamente e, após 30
   minutos sem atividade administrativa, qualquer tentativa de CRUD exige nova
   autorização sem interromper a leitura.

## Fora de escopo

- Alterar o conteúdo, formato ou catálogo das cifras.
- Expor o servidor à internet ou configurar encaminhamento de portas.
- Tornar as páginas de leitura dependentes de senha.
- Remover ou substituir a autenticação de escrita já aplicada pelo servidor.

## Decisões confirmadas

- O acesso na rede local deve usar somente HTTP; HTTPS não é requisito desta
  mudança.
- Endereço que apresentou o erro: `http://192.168.100.101:8000/configuracoes.html`.
- Senha incorreta deve exibir erro e permitir nova tentativa, sem bloqueio
  temporário.
- O acesso administrativo deve funcionar em todas as páginas individuais de
  cifras servidas pelo projeto.
- A autorização expira após 30 minutos sem atividade administrativa e a
  interface deve oferecer uma ação explícita para sair.
