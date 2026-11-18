# Plano de implementação — modo de apresentação no índice

**Não executar até ordem explícita do usuário.**

## 1. Casca e preferências

- [x] Criar módulo compartilhado (ex.: `assets/presentation-mode.js`) e CSS.
- [x] Carregar o módulo nos índices via `assets/index.js`.
- [x] Botão **Modo de apresentação** à direita do Holyrics (antes do Pad).
- [x] Persistir on/off; aplicar tema do índice + ocultar `.capo-btn`.
- [x] Linha **fundo** / **rolagem** / **slide** abaixo de `.index-actions` só com modo on.

## 2. Parse e filtros

- [x] Fetch da cifra pelo `href` sem navegar.
- [x] Extrair título como estrofe apresentável.
- [x] Dividir estrofes; filtrar linhas de acorde e `[...]`; remover estrofes vazias.
- [x] Estado vazio → mensagem no modal.

## 3. Modal comum

- [x] Fullscreen best-effort + fallback viewport.
- [x] Botão ESC + tecla Esc.
- [x] Tipografia branca com contorno preto por glifo.
- [x] Clique metade esquerda/direita; setas; buffer 2 dígitos + Enter.
- [x] Controles +/− com autoajuste para caber.

## 4. Modo slide

- [x] Um slide por estrofe, centralizado.
- [x] Extremos sem ciclo.

## 5. Modo rolagem

- [x] Fluxo contínuo filtrado, rolagem manual.
- [x] Estrofe vigente destacada; setas/números/metades centralizam com rolagem suave.
- [x] Clique numa estrofe seleciona, destaca e centraliza.
- [x] Extremos sem ciclo.

## 6. Fundo

- [x] Input de imagem; persistir até nova escolha; fallback preto.

## 7. Verificação

- [x] Índice managed, litúrgico e legado: interceptação e Capo oculto.
- [x] Modo off restaura navegação e Capo.
- [x] Persistência entre dois índices diferentes.
- [x] Bump de cache `?v=` em `assets/index.js`.
- [x] Não alterar páginas de cifra individuais.
