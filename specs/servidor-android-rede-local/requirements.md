# Servidor Python no Android para a rede local

## Estado

**Implementação parcial:** modo LAN autenticado, interface de senha e script
Termux adicionados. Sincronização GitHub e validação ponta a ponta no aparelho
continuam pendentes.

## Contexto

O projeto já possui um servidor Python que entrega as páginas HTML e oferece
operações locais para gerenciar eventos, cifras e capotrastes, editar cifras e
importar conteúdo. Hoje ele escuta exclusivamente em `127.0.0.1`, adequado ao
uso no computador, mas inacessível aos demais aparelhos da rede.

O objetivo é usar um Moto G7 Play como servidor temporário da rede Wi-Fi local,
permitindo que outros aparelhos abram o projeto no navegador e utilizem o CRUD.
O PDF de referência apresenta Flutter com Python embarcado como uma alternativa,
mas o requisito atualizado é preferir a execução do Python existente no Android,
sem Flutter e com o mínimo de mudanças. O aparelho é um Moto G7 Play com
Android 10. Termux é a hipótese inicial a validar no dispositivo.

## Objetivo

Executar uma cópia independente do repositório no celular e disponibilizar o
servidor Python existente pelo IP local do celular, em uma porta fixa, somente
para uso na rede local. Preservar o funcionamento atual no computador.

## Requisitos funcionais

### RF-01 — Execução sem aplicativo Flutter

O servidor deve ser executado no Android por um ambiente capaz de rodar o Python
do projeto, preferencialmente Termux, sem criar um aplicativo Flutter nem
incorporar uma runtime Python ao produto.

Antes da implementação, deve-se validar no Moto G7 Play a disponibilidade do
ambiente Python e a compatibilidade das dependências usadas pelos fluxos
existentes, especialmente importação de cifras, no Android 10.

### RF-02 — Cópia de trabalho independente

O servidor no celular deve operar sobre uma cópia completa do projeto armazenada
no próprio celular. A cópia não deve depender de o PC estar ligado ou conectado.
As operações de CRUD devem alterar essa cópia e manter os arquivos, caminhos,
catálogo e convenções que o projeto já utiliza.

### RF-03 — Acesso pela rede Wi-Fi local

Um aparelho conectado à mesma rede Wi-Fi deve conseguir abrir a interface usando
o IP local do celular e a porta configurada, por exemplo
`http://<ip-do-celular>:8000/configuracoes.html`.

O endereço e a porta efetivamente disponíveis devem ser apresentados no celular
ou no terminal usado para iniciar o servidor. A documentação deve explicar como
consultar o IP e como confirmar que os aparelhos estão na mesma rede.

O servidor não deve exigir Flutter, acesso à internet para atender requisições
locais, encaminhamento de portas no roteador ou publicação do servidor na
internet. O produto deve alertar que o HTTP da rede local não cifra o tráfego e
que a senha não torna apropriado usar redes Wi-Fi públicas ou não confiáveis.

### RF-04 — Preservar o modo local do computador

O modo atual em `127.0.0.1` deve continuar sendo o padrão no computador. A
exposição à rede deve ser explícita no modo de execução destinado ao celular e
não pode alterar silenciosamente os atalhos ou instaladores já existentes.

### RF-05 — Autenticação de operações que alteram dados

Leitura de páginas, cifras, índices e status pode continuar disponível aos
aparelhos da rede local sem login. Toda operação que altere conteúdo ou controle
o servidor deve exigir uma senha configurada localmente no celular, incluindo:

- criação, edição e exclusão de eventos, cifras e capotrastes;
- gravação do texto de uma cifra;
- importação de cifras;
- encerramento do servidor e demais ações administrativas.

A senha não deve ser incluída no repositório, na URL, em logs ou em mensagens de
erro. A interface deve solicitar a senha sem enviá-la a terceiros. O servidor
deve proteger os endpoints de escrita, não somente ocultar os controles na
interface.

### RF-06 — Endereço permitido e limites de rede

O acesso pela rede deve ser restrito à rede local prevista para o uso. A
implementação deve validar o host e a origem das requisições, evitar que páginas
de outros sites usem o servidor para gravar arquivos e impedir exposição
acidental em interfaces ou redes não pretendidas, na medida suportada pelo
Android e pelo ambiente escolhido.

Como a interface de leitura não exige senha, a documentação deve deixar explícito
que qualquer aparelho autorizado a entrar na mesma rede poderá ler os arquivos
servidos. Não se deve configurar encaminhamento de portas ou acesso remoto pela
internet.

### RF-07 — Execução e recuperação no Android

O fluxo inicial deve poder ser iniciado manualmente pelo usuário. Enquanto
estiver em execução, deve informar se o servidor está ativo e o endereço local
de acesso. Se o Android interromper o processo, o comportamento esperado nesta
versão é orientar o usuário a iniciar novamente; não se exige início automático
após reinicialização do celular.

As instruções devem explicar limitações de economia de bateria e suspensão do
Android, sem prometer disponibilidade contínua com a tela apagada. Se for
necessário manter o aparelho desperto durante o uso, a solução deve ser
explícita, reversível e limitada ao período em que o servidor estiver ativo.

### RF-08 — Sincronização com GitHub

O celular deve usar a cópia do repositório GitHub. A sincronização desejada é:

- enviar ao GitHub as alterações feitas pelo CRUD automaticamente, em ciclos
  de aproximadamente uma hora enquanto o processo estiver ativo;
- oferecer uma ação explícita para enviar/sincronizar imediatamente, quando
  solicitada pelo usuário;
- buscar alterações remotas antes de iniciar o servidor, desde que isso possa
  ser feito sem sobrescrever alterações locais.

A sincronização automática não deve usar `git push --force`, descartar arquivos,
nem executar um `git add -A` indiscriminado. Deve enviar somente alterações
geradas pelas operações suportadas do produto. Se houver divergência ou conflito
que não possa ser resolvido sem risco, deve preservar os arquivos locais,
interromper a sincronização daquela rodada e informar o problema, em vez de
aplicar uma resolução automática.

A credencial necessária para enviar ao GitHub deve ser configurada no próprio
celular, com a menor permissão possível. Ela não pode ser gravada em arquivos
rastreados pelo Git, URLs de remoto, logs ou respostas da API. O projeto pode
publicar conteúdo pelo GitHub Pages; o usuário aceita essa consequência ao
sincronizar alterações para o repositório.

Para permitir a sincronização automática sem digitação a cada ciclo, a proposta
é usar uma chave SSH exclusiva do celular, cadastrada no repositório como chave
de deploy com permissão de escrita e sem frase secreta. A chave privada deve
ficar no armazenamento privado do Termux, fora do repositório e com permissões
restritas. O usuário aceita que alguém com acesso a esse armazenamento poderá
enviar alterações ao repositório; a chave deve poder ser revogada
independentemente de outras credenciais.

As limitações do Android se aplicam também à sincronização horária: se o sistema
encerrar o processo ou o celular estiver indisponível, a sincronização pendente
deve ser tentada novamente ao reiniciar o servidor ou ao solicitar sincronização
manual.

## Critérios de aceite

1. No Moto G7 Play, o servidor Python existente pode ser iniciado sem Flutter,
   após a preparação documentada do ambiente Android.
2. Um segundo aparelho na mesma rede Wi-Fi abre as configurações e páginas de
   eventos pelo IP local do celular.
3. O CRUD de eventos, cifras e capotrastes, a edição e a importação funcionam
   pela rede e persistem na cópia do projeto no celular.
4. Toda operação de escrita ou administração exige autenticação no servidor;
   chamadas diretas à API sem autenticação são recusadas.
5. A leitura sem autenticação permanece restrita ao uso da rede local, conforme
   os limites de rede documentados.
6. O modo existente no PC continua vinculado a `127.0.0.1` por padrão e os
   testes existentes do servidor continuam passando.
7. O endereço IP e a porta são informados ao iniciar o servidor; após uma
   interrupção, as instruções permitem iniciá-lo novamente.
8. Alterações feitas pelo CRUD são enviadas ao GitHub no ciclo previsto ou
   mediante ação explícita, sem incluir a credencial em arquivos ou logs.
9. Conflitos ou falhas de rede não descartam alterações locais nem resultam em
   sobrescrita forçada; o usuário recebe uma mensagem clara e pode tentar
   novamente.
10. As instruções explicam que o conteúdo sincronizado pode ser publicado pelo
    GitHub Pages e que a senha não cifra o tráfego HTTP da rede local.

## Fora de escopo

- Criar ou manter um aplicativo Flutter.
- Acesso ao servidor pela internet, VPN ou encaminhamento de portas.
- Garantir execução ininterrupta após reinicialização ou encerramento pelo
  Android.
- Alterar o formato das páginas, o conteúdo das cifras ou o modelo do CRUD.
- Publicar alterações sem a sincronização prevista ou sobrescrever conflitos
  automaticamente.

## Decisões ainda sujeitas à validação técnica

- Disponibilidade e compatibilidade do Termux/Python e das dependências de
  importação no aparelho.
- Forma de manter o ciclo de sincronização ativo sob as políticas de bateria do
  Android.
- Estratégia técnica de autenticação compatível com os clientes e com o HTTP na
  rede local.
