# Projeto técnico — Servidor Android na rede local

## Abordagem proposta

**Estado:** o núcleo LAN está implementado com bind no IPv4 privado da rota
ativa, restrição de sub-rede/Host, autenticação por senha e cliente web
compartilhado. A instalação e o teste físico no Moto G7 Play e a sincronização
GitHub ainda não foram concluídos.

Preferir a reutilização do servidor Python e da cópia completa do projeto em um
ambiente Python para Android, inicialmente Termux. Não criar aplicativo Flutter
nem embutir Python. A viabilidade deve ser confirmada no Moto G7 Play antes de
escolher versões de pacotes ou afirmar suporte à execução prolongada.
O aparelho está identificado como Android 10; validar a compatibilidade dessa
versão com o ambiente e as dependências antes de implementar.

O fluxo esperado é:

1. Preparar no celular uma cópia independente do repositório e o ambiente Python.
2. Atualizar a cópia com segurança antes da inicialização, sem substituir
   alterações locais.
3. Iniciar o servidor no modo de rede local, mantendo `127.0.0.1` como padrão
   para o uso atual no computador.
4. Informar o endereço IP local e a porta e abrir a interface pelo navegador de
   outro aparelho conectado à mesma rede Wi-Fi.
5. Exigir autenticação no servidor para todas as operações que alterem arquivos
   ou controlem o processo.
6. Registrar as alterações feitas pelo CRUD para sincronizá-las ao GitHub em
   ciclos horários ou por solicitação explícita, com falhas e conflitos
   reportados sem descartar dados.

## Mudanças esperadas no servidor existente

O servidor atual se vincula a `127.0.0.1`, rejeita hosts diferentes de
`localhost`/`127.0.0.1` e não possui autenticação. A implementação deverá
introduzir um modo de escuta de rede explícito, preservando os valores padrão e
as salvaguardas existentes no modo local.

Antes de aceitar a implementação, definir e testar como o modo de rede:

- limita requisições à rede local pretendida;
- aceita o IP do celular no cabeçalho `Host` sem abrir acesso arbitrário;
- mantém a proteção contra gravações originadas por outras páginas;
- autentica cada endpoint de escrita, importação e administração;
- mantém páginas e endpoints de leitura disponíveis conforme a decisão de
  acesso sem senha;
- exibe um erro compreensível quando o IP muda, a porta está ocupada ou a rede
  não permite comunicação entre clientes.

A interface existente pode continuar sendo a interface de administração. A
autenticação não pode depender apenas de esconder botões no navegador: o servidor
deve verificar a credencial em cada requisição que modifica dados. A credencial
e qualquer estado de sessão devem ficar fora do repositório e dos logs. Como o
transporte é HTTP na LAN, a especificação não deve sugerir que a senha protege
contra interceptação por outros participantes da rede.

## Cópia local e atualização Git

O clone no celular é a origem das alterações feitas no celular. A sincronização
deve distinguir arquivos que o CRUD alterou de outras mudanças existentes na
cópia; não usar `git add -A` sem controle de escopo.

O fluxo deve registrar os caminhos tocados por cada operação suportada. Uma
rodada de envio agrupa as alterações pendentes, cria um commit identificável e
envia sem forçar o remoto. Antes de iniciar, atualiza a referência remota e só
aplica uma atualização que não perca alterações locais. Se o histórico divergir
ou ocorrer conflito, preservar a cópia local, cancelar a rodada e apresentar
instruções para resolução manual.

A sincronização horária é melhor esforço: Android pode suspender ou encerrar o
processo. Ao reiniciar ou solicitar sincronização manual, o sistema deve
verificar operações pendentes e exibir o resultado. Atualizações de código que
cheguem enquanto o servidor estiver ativo não devem substituir arquivos em uso;
devem ser aplicadas com segurança antes da próxima inicialização, ou ficar
pendentes até o reinício.

Credenciais GitHub devem ser solicitadas/configuradas localmente e mantidas em
armazenamento privado do ambiente Android. Não armazenar token em configuração
rastreada pelo Git, remoto Git, linha de comando registrada ou logs. Validar a
permissão mínima necessária e o efeito do GitHub Pages antes de habilitar envio
automático.

A credencial prevista é uma chave SSH exclusiva do aparelho, cadastrada como
deploy key de escrita apenas neste repositório. Ela não terá frase secreta para
viabilizar o envio horário sem intervenção; portanto, o armazenamento privado
do Termux e o bloqueio do aparelho são parte do modelo de segurança. A chave
deve ser revogável sem afetar outras credenciais. O roteiro operacional está em
`setup.md`.

## Inicialização e operação

A primeira versão deve ser iniciada manualmente. A documentação deve cobrir
preparação da cópia, instalação/verificação do Python e dependências,
configuração local da autenticação e da credencial GitHub, início/parada do
servidor, descoberta do IP e diagnóstico de conectividade.

Não prometer execução permanente em segundo plano. Qualquer mecanismo para
reduzir suspensão deve ser ativado apenas durante o uso, ter instrução clara para
desativação e não substituir os controles de energia do Android.

## Verificação proposta

- Executar os testes de unidade existentes do servidor e do gerenciador.
- Testar por cliente HTTP que o modo padrão continua inacessível pela rede.
- Testar em uma rede Wi-Fi real: abrir páginas e configurações por IP local,
  autenticar as operações de escrita e verificar persistência dos arquivos.
- Exercitar os endpoints diretamente, sem interface, para confirmar que
  nenhuma escrita ou ação administrativa ignora autenticação.
- Testar credencial ausente/incorreta, host inválido, cliente fora da rede
  permitida, IP alterado, porta ocupada, desconexão de Wi-Fi e processo
  interrompido.
- Testar sincronização sem mudanças, com alterações locais, com alterações
  remotas, com divergência e sem conexão; confirmar que falhas não removem nem
  sobrescrevem arquivos locais.
- Validar no Moto G7 Play os fluxos críticos, inclusive importação de cifras e
  comportamento com tela apagada, se esse cenário for suportado.
