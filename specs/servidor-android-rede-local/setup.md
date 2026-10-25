# Passo a passo — configurar o servidor no celular

**Estado:** o modo LAN autenticado e o script Termux foram implementados. A
instalação de Python no Moto G7 Play, o teste com um segundo aparelho, a
importação Cifra Club e a sincronização GitHub ainda dependem de validação ou
implementação.

## Visão geral

O celular será um computador pequeno ligado à rede Wi-Fi. O Termux fornecerá o
terminal, Python e Git. Uma cópia própria do repositório ficará dentro do
armazenamento privado do Termux. O servidor será iniciado manualmente e os
outros aparelhos acessarão a URL local informada por ele.

O servidor usa somente a biblioteca padrão para servir páginas e executar o
CRUD. A importação Cifra Club tem dependências adicionais (Playwright,
Chromium, pytesseract e Tesseract) e não deve ser considerada compatível com
Android até que esse fluxo seja testado no aparelho.

## A. Preparação do celular e do ambiente

1. **Conectar à rede Wi-Fi que será usada.** O celular servidor e os aparelhos
   clientes devem estar na mesma rede. Não configurar encaminhamento de portas
   no roteador. Se os aparelhos não se enxergarem, verificar se a rede tem
   isolamento entre clientes (client/AP isolation).

2. **Instalar Termux de uma fonte oficial.** Usar a página de instalação do
   projeto Termux:
   <https://github.com/termux/termux-app#installation>. Android 10 está dentro
   da faixa de Android indicada pelo projeto. Instalar Termux e eventuais
   complementos sempre da mesma fonte; não misturar APKs assinados por fontes
   diferentes.

3. **Atualizar os pacotes e instalar Python, Git e OpenSSH.** No Termux:

   ```sh
   pkg update
   pkg install python git iproute2
   ```

   Confirmar as ferramentas:

   ```sh
   python --version
   git --version
   ssh -V
   ```

4. **Criar uma cópia independente do projeto no espaço privado do Termux.**
   Não clonar para uma pasta compartilhada de downloads. Exemplo:

   ```sh
   mkdir -p ~/projetos
   cd ~/projetos
   git clone https://github.com/emanuel3fernvf/cifras-2ipb-caratinga.git
   cd cifras-2ipb-caratinga
   ```

   A clonagem HTTPS acima serve para obter a cópia pública. A configuração de
   escrita por SSH é feita no passo C, antes de ativar envios ao GitHub.

5. **Conferir versão e dependências do projeto.** O servidor e o CRUD usam
   somente módulos da biblioteca padrão do Python. A importação Cifra Club
   depende de Playwright/Chromium, pytesseract, Tesseract e Pillow; não instalar
   dependências presumidas nem contar com esse recurso até que sua
   compatibilidade seja validada no Moto G7 Play com Android 10.

6. **Manter o Termux ativo durante o uso.** Nas configurações do Android, abrir
   as informações do Termux e permitir atividade em segundo plano / remover a
   otimização de bateria, se essa opção existir na versão do sistema. O nome do
   menu pode variar. Manter o Termux aberto enquanto o servidor estiver em uso.
   A disponibilidade com a tela apagada será testada no aparelho; o Android
   ainda pode encerrar o processo.

## B. Iniciar o servidor LAN autenticado

7. **Preparar a senha administrativa.** Na primeira configuração do servidor,
   definir localmente uma senha forte para operações de CRUD, gravação,
   importação e administração. A senha não deve ser enviada nesta conversa,
   incluída em comandos salvos, escrita no repositório nem registrada em logs.
   Na primeira inicialização do script LAN, o Termux pede a senha duas vezes
   sem mostrá-la. Ela deve ter pelo menos 12 caracteres. O arquivo local guarda
   apenas um hash PBKDF2, fora do projeto, em
   `~/.config/cifras-2ipb/server-auth.json`, com permissões `0600` (arquivo) e
   `0700` (pasta). Não envie a senha nesta conversa nem a coloque em comandos.

8. **Iniciar o servidor no modo de rede local.** No diretório do projeto:

   ```sh
   bash termux/iniciar_servidor.sh
   ```

   O script exige Python 3.10 ou superior. O servidor identifica a rota IPv4
   privada ativa, vincula-se somente a esse IP e informa a URL e a porta.
   `PORT=8765 bash termux/iniciar_servidor.sh` permite escolher outra porta. O
   modo usual do computador continua em `127.0.0.1`.

   **Não usar o comando atual do PC para tentar acesso pela rede:** ele escuta
   apenas em `127.0.0.1`, e não é seguro contornar isso sem as proteções
   previstas na spec.

9. **Abrir o endereço a partir de outro aparelho.** No navegador do aparelho
   cliente, abrir a URL anunciada pelo servidor, por exemplo:

   ```text
   http://IP-LOCAL-DO-CELULAR:8000/configuracoes.html
   ```

   O IP e a porta reais devem ser os apresentados pelo servidor. Confirmar que
   configurações e eventos carregam. A leitura fica acessível aos aparelhos da
   sub-rede; HTTP não cifra o tráfego. O servidor bloqueia listagem de diretório
   e arquivos ocultos/ambientes locais.

10. **Autenticar operações de escrita.** Ao criar, editar, excluir, importar,
    salvar cifra ou parar o servidor, a interface solicitará a senha. A API
    recusa essas operações sem credencial válida; esconder botões na página não
    é suficiente. O navegador mantém a senha apenas em memória na sessão atual.

11. **Validar a cópia do celular.** Criar ou editar um evento de teste e
    verificar que os arquivos correspondentes foram alterados dentro de
    `~/projetos/cifras-2ipb-caratinga`. Confirmar catálogo e navegação antes de
    usar dados reais.

## C. Sincronização GitHub — ainda não implementada

12. **Somente após a sincronização ser implementada e revisada**, criar uma
    chave SSH exclusiva do celular. A spec adota uma chave
    dedicada para este repositório, sem frase secreta para permitir as
    sincronizações horárias sem intervenção. O arquivo privado ficará na área
    privada do Termux, fora do repositório, com permissões restritas.

    Essa opção permite automação, mas significa que alguém com acesso ao
    armazenamento privado do Termux poderá usar a chave para enviar alterações
    ao repositório. Proteger o celular com bloqueio de tela e não compartilhar
    cópias da chave privada. A chave privada nunca deve ser enviada, colada em
    tickets, conversas ou no GitHub.

13. **Cadastrar somente a chave pública no GitHub.** Em Settings → Deploy keys
    do repositório `cifras-2ipb-caratinga`, cadastrar a chave pública e habilitar
    escrita. A chave deve ser exclusiva deste aparelho/repositório, para que
    possa ser revogada sem afetar outras contas ou máquinas.

14. **Configurar o remoto SSH e testar a autenticação.** O comando exato e a
    forma de guardar a chave serão incluídos no instalador/documentação da
    implementação. Antes de habilitar sincronização, confirmar que o Git
    consegue autenticar com a chave exclusiva e que ela só tem acesso ao
    repositório pretendido.

15. **Definir a identidade de commit.** Configurar nome e e-mail de commit no
    Git do Termux. Escolher conscientemente o e-mail visível no histórico do
    repositório; não usar uma senha ou token como dado de identidade.

16. **Não habilitar envios automáticos nesta versão.** Ainda não há sincronização
    implementada. Não configurar a chave, mudar o remoto ou enviar commits pelo
    procedimento abaixo até que a sincronização com escopo de arquivos,
    preservação de conflitos e publicação pelo GitHub Pages esteja pronta e
    validada.

    Os ciclos horários são melhor esforço: se o Android encerrar Termux ou a
    rede cair, não há garantia de execução no horário. As pendências devem ser
    reavaliadas ao reiniciar ou ao solicitar envio imediato.

## D. Uso normal e encerramento

17. **Para iniciar em cada sessão:** conectar o telefone ao Wi-Fi, abrir
    Termux, entrar na pasta do projeto e executar `bash termux/iniciar_servidor.sh`.
    Conferir a URL e o status informados.

18. **Sincronização:** não há ação “Sincronizar agora” nesta versão. As
    alterações permanecem apenas na cópia local do aparelho.

19. **Para encerrar:** usar a ação de parar servidor na interface autenticada
    ou o procedimento de encerramento indicado no Termux. Confirmar que o
    status mudou para parado. As alterações ficam no aparelho e não são
    sincronizadas automaticamente.

20. **Para voltar a usar depois de uma interrupção:** abrir Termux e iniciar o
    servidor novamente. A sincronização GitHub ainda não está implementada; não
    executar `git reset`, `git clean` ou push forçado como tentativa de
    atualizar a cópia.

## E. Verificações antes de considerar a configuração pronta

- [ ] Python e Git funcionam no Android 10 do Moto G7 Play.
- [ ] Uma segunda máquina acessa a interface pelo IP Wi-Fi, mas o servidor não
      fica exposto pela internet.
- [ ] Os fluxos de leitura, CRUD, capotrastes, edição e importação foram
      testados no aparelho.
- [ ] Operações de escrita sem senha são recusadas no servidor.
- [ ] Segredos não aparecem nos arquivos rastreados, URLs ou logs.
- [ ] Um envio SSH de teste usa somente a chave de deploy dedicada.
- [ ] O ciclo horário e a ação imediata foram verificados; sincronização ainda
      não implementada.
- [ ] O comportamento após tela apagada, perda de Wi-Fi e encerramento do
      processo foi documentado com os resultados observados.
