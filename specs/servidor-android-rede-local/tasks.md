# Plano de implementação — Servidor Android na rede local

**Estado:** implementação parcial. O modo LAN autenticado e seu roteiro para
Termux foram implementados; sincronização GitHub e validação física ponta a
ponta ainda estão pendentes.

## 1. Validar o ambiente

- [x] Confirmar a versão do Android no Moto G7 Play: Android 10.
- [x] Instalar Termux 0.118.3 no aparelho.
- [x] Instalar Python/Git/iproute2 no Termux e validar o servidor no Android 10.
- [ ] Verificar dependências e fluxos existentes, incluindo importação de
  cifras, no aparelho. A importação usa Playwright, Chromium, pytesseract e
  Tesseract; compatibilidade Android ainda precisa de validação específica.
- [x] Confirmar o procedimento para copiar/clonar o projeto e o espaço de
  armazenamento necessário.
- [x] Validar conexão entre o Moto G7 Play e o computador na rede Wi-Fi
  escolhida (health check e página de configurações).

## 2. Preparar cópia e execução

- [ ] Definir e documentar a cópia independente do projeto no celular.
- [x] Criar o modo explícito de escuta na rede local, mantendo
  `127.0.0.1` como padrão no computador.
- [x] Detectar e apresentar IP local, porta, URL, falhas de inicialização e
  instruções para reiniciar.
- [x] Documentar início manual, parada, permissões e limitações de energia do
  Android.

## 3. Proteger o acesso

- [x] Definir configuração local de senha sem armazená-la no repositório ou nos
  logs.
- [x] Proteger no servidor todas as operações de CRUD, edição, importação e
  administração.
- [x] Validar host, origem e escopo de rede sem quebrar o modo local existente.
- [x] Comunicar claramente que leituras ficam disponíveis na rede local e que
  HTTP não cifra o tráfego.
- [x] Testar autenticação por chamadas diretas à API e não somente pela
  interface.

## 4. Sincronizar com GitHub

- [ ] Definir armazenamento local seguro da credencial GitHub e permissões
  mínimas necessárias.
- [ ] Registrar os arquivos alterados por operações do produto para limitar o
  escopo de commits automáticos.
- [ ] Buscar atualizações sem sobrescrever alterações locais, aplicando-as
  antes da inicialização ou deixando-as pendentes até reinício.
- [ ] Implementar sincronização de saída em ciclos horários enquanto o processo
  estiver ativo e uma ação de sincronização imediata.
- [ ] Impedir push forçado, publicação de credenciais e inclusão indiscriminada
  de arquivos.
- [ ] Reportar falhas e conflitos com preservação dos dados locais.
- [ ] Informar quando a publicação do repositório/GitHub Pages tornar o conteúdo
  público.

## 5. Validar e documentar

- [x] Registrar o passo a passo para configuração e operação em `setup.md`.
- [x] Executar os testes do servidor e da autenticação LAN.
- [x] Executar os testes existentes de eventos, catálogo e
  compatibilidade.
- [x] Adicionar testes para modo local/rede, autenticação, origem e hosts
  inválidos.
- [ ] Fazer teste ponta a ponta no Moto G7 Play e em um segundo aparelho na
  mesma rede.
- [x] Atualizar as instruções do servidor local, incluindo limitações ainda
  dependentes de validação física.
