# Projeto técnico — modo de apresentação no índice

## Direção

Implementação compartilhada em `assets/`, carregada nos índices via
`assets/index.js` (após a variante / Pad), para cobrir todos os eventos sem
duplicar lógica por pasta.

Candidatos naturais:

- `assets/presentation-mode.js` (novo) — estado, UI do índice, modal, navegação.
- CSS em `assets/index.css` (e/ou folha dedicada) — aparência do modo ativo e
  do modal.
- Ajustes pontuais em `pad.js` se a ordem Holyrics → Apresentação → Pad exigir
  âncora explícita.

## Fluxo

```text
Índice carrega
  -> ler preferências (modo on/off, slide|rolagem, fundo, tamanho)
  -> se modo on: aplicar tema do índice, ocultar .capo-btn, mostrar linha fundo/slide/rolagem
  -> clique em link de música
       | modo off -> navegação normal
       | modo on  -> preventDefault
            -> fetch HTML da cifra
            -> parse estrofes / filtrar linhas (RF-05) / incluir título
            -> se vazio: modal com mensagem
            -> senão: abrir modal, requestFullscreen (best effort)
            -> render slide ou rolagem
```

## Parse da letra

1. `fetch` do `href` da música (mesma pasta do índice).
2. Extrair `body > pre` (ou equivalente) e, se útil, `.holyrics-title`.
3. Reutilizar a noção de estrofe já usada nas cifras (blocos separados por
   linha em branco / `.strophe` se o HTML já processado não estiver disponível
   no fetch estático — no HTML fonte o `<pre>` ainda é texto bruto).
4. No HTML bruto: dividir por linhas em branco; classificar linhas como acorde,
   marcador `[...]` ou verso (critérios alinhados ao processador de cifras /
   exportação Holyrics).
5. Título: garantir um bloco apresentável com o título da música (rótulo do
   link ou `.holyrics-title` / primeira linha de título do pre), tratado como
   estrofe normal na sequência.

## Navegação numérica

- Buffer de no máximo 2 dígitos enquanto a apresentação está aberta.
- `Enter` confirma; limpa o buffer.
- Índice interno 0-based; exibição/entrada 1-based.
- `N > total` → último slide/estrofe.
- Teclas fora de dígitos/Enter/setas/Esc não acumulam no buffer de forma
  ambígua (Esc limpa e/ou fecha conforme RF-04).

## Fullscreen e fundo

- `element.requestFullscreen()` no container do modal no gesto do clique.
- Falha: manter `position: fixed; inset: 0; z-index` alto.
- Fundo: `localStorage` (ou IndexedDB se necessário) com data URL / blob key;
  ao falhar quota → preto sólido e, se possível, avisar discretamente.

## Texto

- Contorno: combinação de `-webkit-text-stroke` e/ou `text-shadow` em múltiplas
  direções para borda por glifo.
- +/− ajusta tamanho base; após cada mudança de slide/tamanho, medir overflow
  e reduzir fonte até caber (modo slide) ou até a estrofe alvo caber na
  viewport útil (modo rolagem, se aplicável ao bloco focado).

## Interceptação de links

Seletores amplos em `#content`: `a[href$=".html"]` que apontam para cifras do
evento, excluindo Capo (já oculto) e âncoras não-música. Capo:
`display: none` via classe no `body` quando modo ativo
(ex.: `body.presentation-mode-on .capo-btn { display: none }`).

## Persistência (chaves sugeridas)

| Chave                                      | Valor        |
|--------------------------------------------|--------------|
| `catalog-presentation-mode`                | `1` / `0`    |
| `catalog-presentation-view`                | `slide` / `scroll` |
| `catalog-presentation-bg`                  | data URL ou vazio |
| `catalog-presentation-font` (opcional)     | percent      |

## Riscos

- HTML de cifra bruto vs. já processado: o fetch retorna fonte com `<pre>`
  texto; o parse deve ser no texto, não depender de `.strophe` no DOM remoto.
- Ordem Pad vs. novo botão: garantir inserção estável à direita do Holyrics.
- iOS: fullscreen limitado; fallback viewport é requisito aceito.
