# Especificação: modo de apresentação no índice do evento

## Estado

**Fechada e pronta para implementação sob ordem explícita do usuário.**

Escopo, comportamento e critérios de aceite foram confirmados.
**Não implementar até o usuário pedir explicitamente.**

## Contexto

Nos índices de evento, a área `.index-actions` contém o botão Holyrics
(`#holyrics-export-btn`) e o Pad injetado por `assets/pad.js`. As músicas
aparecem como links em `#content` (`.managed-song-row`, `.song-link-row`,
links legados, etc.).

Hoje, clicar numa música navega para a página da cifra. Não existe modo de
apresentação, fullscreen nem modal de slides no índice.

## Decisões confirmadas

- Vale para **todos** os índices do catálogo (managed, litúrgicos e legados).
- Com o modo ativo, botões **Capo** ficam **ocultos**.
- Slides numerados a partir de **1**.
- Salto numérico: até **dois dígitos**; confirmação com **Enter**; número maior
  que o total vai para o **último** slide.
- Imagem de fundo: persistida neste navegador **até o usuário escolher outra**;
  se não couber no armazenamento, fallback **fundo preto** ok.
- Tamanho do texto: controles **+/−** na apresentação; se ainda assim a estrofe
  não couber, **autoajustar** para caber sem cortar.
- Se fullscreen nativo falhar: modal em 100% da viewport + ESC basta.
- Nos extremos, setas **param** (não ciclam).
- Sem estrofe apresentável: abrir modal com **mensagem** adequada.
- **Título** da música entra como **estrofe/slide normal** (não é omitido).
- Ordem em `.index-actions`: Holyrics → **Modo de apresentação** → Pad.
- Estilo visual do índice com modo ativo: escolha do agente, desde que seja
  claramente distinto do modo normal.
- Implementação só após ordem explícita do usuário.

## Objetivo

Permitir que o índice do evento entre em um **modo de apresentação** persistente.
Nesse modo, clicar numa música abre um modal em tela cheia com a letra (sem
acordes/marcadores), navegável como slides ou com rolagem, adequada a projetor
e celular, sem sair da página do índice.

## Escopo

- Páginas de **índice** de pastas do catálogo (não páginas individuais de cifra).
- Código compartilhado em `assets/` (JS/CSS), alinhado ao carregador
  `assets/index.js`.
- Template `_referencia_evento/index.html` e índices existentes alcançáveis pela
  implementação compartilhada.

Fora de escopo: alterar o fluxo das páginas de cifra, Holyrics, Pad, editor
local ou CRUD além do necessário para botão/controles/ocultar Capo.

---

## Requisitos funcionais

### RF-01 — Botão Modo de apresentação

1. À direita do Holyrics e à esquerda do Pad, existe o botão com texto
   **Modo de apresentação**.
2. Alterna ligado/desligado.
3. Estado persistido neste navegador (mesma origem) entre índices/eventos.

### RF-02 — Aparência do índice com modo ativo

1. Com o modo ativo, a página do índice muda de aparência de forma óbvia
   (não só o botão).
2. Botões **Capo** ficam ocultos enquanto o modo estiver ativo.
3. Estilo concreto: escolha da implementação.

### RF-03 — Interceptação dos links de música

1. Modo desligado: links (e Capo, quando visível) comportam-se como hoje.
2. Modo ligado: clicar no link da música **não** navega; abre o modal daquela
   música. Aplica-se a todos os formatos de link de música do índice.

### RF-04 — Modal de apresentação (comum)

1. Ocupa a tela inteira; tenta fullscreen do navegador; se falhar, permanece
   em 100% da viewport da página.
2. **Esc** e botão **ESC** (canto superior esquerdo) fecham a apresentação e
   saem do fullscreen quando aplicável.
3. Letra em **branco** com contorno **preto em cada glifo**.
4. Quebra de palavras para não ultrapassar bordas; conteúdo exibido sem corte
   nas beiradas (com autoajuste se necessário — RF-11).
5. Metade esquerda: anterior; metade direita: próximo.
6. Setas do teclado navegam conforme RF-07 / RF-08 e **param** nos extremos.
7. Dígitos (máx. 2) + **Enter** saltam para o slide N (1-based); se N for maior
   que o total, vai ao **último**.

### RF-05 — Estrofes e linhas

1. Estrofe ignorada se, após filtrar, não restar verso — só acordes e/ou
   linhas com colchetes (`[...]` / `[]`).
2. Mistura de (acorde/colchetes) + verso: apresenta a estrofe **sem** as linhas
   de acorde/colchetes e **sem** deixar espaço vazio no lugar.
3. O **título** da música é tratado como estrofe apresentável normal (entra na
   sequência de slides/rolagem como as demais estrofes de verso).

### RF-06 — Controles sob `.index-actions`

1. Só com modo ativo, abaixo de `.index-actions`: linha com **fundo**,
   **rolagem** e **slide**.
2. **fundo**: seletor de imagem para o fundo do modal; persiste até outra
   seleção; falha de armazenamento → fundo preto.
3. **rolagem** / **slide**: mutuamente exclusivos; escolha persistida.
4. Com modo desligado, essa linha não aparece.

### RF-07 — Modo slide

1. Cada estrofe apresentável (incluindo título) é um slide, um por vez,
   centralizado horizontal e verticalmente.
2. Navegação: setas, metades da tela, números+Enter.
3. Extremos: setas não ciclam.

### RF-08 — Modo rolagem

1. Mesmo modal fullscreen; letra filtrada em fluxo contínuo rolável.
2. Rolagem manual permitida.
3. A estrofe vigente fica **destacada** visualmente; as demais ficam atenuadas.
4. Setas, metades (fora de uma estrofe) e números+Enter navegam entre estrofes
   com **rolagem suave**, centralizando a estrofe alvo na área visível.
5. Clique numa estrofe: ela vira a vigente, destaca e centraliza (como navegar
   para aquele índice).
6. Extremos: param.

### RF-09 — Conteúdo vazio

Se não houver estrofe apresentável após o filtro, o modal abre com mensagem
clara (ex.: “Sem letra apresentável”), sem falhar silenciosamente.

### RF-10 — Persistências

| Preferência              | Persistida                         |
|--------------------------|------------------------------------|
| Modo apresentação on/off | Sim (navegador/origem)             |
| Rolagem vs slide         | Sim (navegador/origem)             |
| Imagem de fundo          | Sim, até escolher outra; senão preto |

### RF-11 — Tamanho do texto na apresentação

1. Controles **+** e **−** visíveis na apresentação.
2. Preferência de tamanho pode seguir o padrão do projeto (persistir no
   navegador) se a implementação compartilhada já o fizer; caso contrário,
   ao menos na sessão da apresentação.
3. Se a estrofe atual (modo slide) ou o bloco alvo não couber na viewport com
   o tamanho escolhido, autoajustar para baixo até caber sem corte.

### RF-12 — Carregamento

Conteúdo obtido da cifra do link clicado, sem navegar para a página da cifra.
Detalhe técnico no `design.md`.

---

## Critérios de aceite

- Modo desligado: índice, Capo e links como hoje.
- Modo ligado: índice visualmente distinto; Capo oculto; botão reflete estado;
  estado sobrevive a troca de índice no mesmo navegador.
- Ordem dos controles: Holyrics → Modo de apresentação → Pad.
- Clique na música abre modal sem sair do índice; tenta fullscreen; fallback
  viewport ok.
- Título aparece como slide/bloco; acordes e `[...]` não; estrofes só com esses
  conteúdos somem; misturas sem buracos.
- Slide: uma estrofe centralizada; setas/metades param nos extremos.
- Rolagem: fluxo filtrado; estrofe vigente destacada e centralizada com rolagem
  suave; clique na estrofe seleciona/centraliza.
- Digitar até 2 dígitos + Enter vai ao slide N (1-based) ou ao último se N >
  total.
- +/− na apresentação; autoajuste se não couber.
- Fundo escolhido persiste até nova escolha; falha → preto.
- Sem letra: mensagem no modal.
- Esc / botão ESC fecha.
- **Nada implementado até ordem explícita.**

## Fora de escopo

- Páginas individuais de cifra (comportamento atual intacto).
- Mudanças em Holyrics, Pad ou CRUD além do encaixe do botão e ocultar Capo.
