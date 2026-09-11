# Plano de implementação — revisão de palavras na exportação para o Holyrics

## 1. Inventário e remoção da regra antiga

- [ ] Inventariar o template e os eventos que possuem exportação para Holyrics.
- [ ] Remover `HOLYRICS_HYPHEN_WORDS` e a orientação comentada para IA/agentes.
- [ ] Remover a limpeza automática baseada na allowlist, sem deixar regra
  linguística equivalente.

## 2. Coleta e transformação

- [ ] Separar carregamento/interpretação das músicas da geração do download.
- [ ] Coletar tokens com `-` ou `_` somente nas linhas de letra exportáveis.
- [ ] Deduplicar tokens por igualdade exata.
- [ ] Produzir a alternativa corrigida removendo apenas `-` e `_`.
- [ ] Aplicar somente as correções selecionadas e somente por token exato.

## 3. Modal de revisão

- [ ] Incluir o diálogo e o backdrop no template e nos índices atendidos.
- [ ] Renderizar um card por token, com original selecionado por padrão.
- [ ] Implementar as escolhas mutuamente exclusivas em cada card.
- [ ] Implementar layout em colunas com wrap e proteção contra overflow.
- [ ] Incluir estado vazio, rolagem interna e ações **Cancelar** e **Baixar**.
- [ ] Impedir fechamento por clique fora e bloquear a interação/rolagem de fundo.
- [ ] Implementar trap e restauração de foco e cancelamento por `Escape`.

## 4. Integração da exportação

- [ ] Abrir o modal após a escolha de qualquer um dos dois modos.
- [ ] Manter o modo escolhido até a confirmação.
- [ ] Gerar e baixar o JSON somente ao clicar em **Baixar**.
- [ ] Descartar o estado ao cancelar ou concluir.
- [ ] Preservar schema, metadados, nomes de arquivo e tratamento de erros atuais.

## 5. Propagação e verificação

- [ ] Atualizar `_referencia_evento` como fonte para eventos futuros.
- [ ] Propagar cuidadosamente a funcionalidade aos eventos existentes que têm o
  exportador, sem sobrescrever diferenças fora do escopo.
- [ ] Cobrir coleta, deduplicação e substituição com testes automatizados.
- [ ] Validar os dois modos, estado vazio, falha de carregamento e cancelamento.
- [ ] Validar teclado, foco, clique no backdrop e viewport móvel/desktop.
- [ ] Confirmar que nenhuma instrução para IA/agentes ou allowlist permanece nos
  exportadores atualizados.

## Estado

**Não iniciado. Este documento não autoriza nem registra mudanças de código.**
