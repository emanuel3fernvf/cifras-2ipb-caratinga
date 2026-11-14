# Projeto técnico — recursos compartilhados do catálogo e acesso ao Pad

## Estado

**Implementação concluída após ordem explícita do usuário.**
O escopo e o destino das variantes G1–G9 foram decididos.

## Evidências do código antes da implementação

- As pastas listadas pelo catálogo possuem ou herdam referências para arquivos
  locais `index.js` e `index.css`, inclusive pastas não nomeadas por data.
- `event_manager.py` copia `index.html`, `index.css` e `index.js` do diretório de
  referência ao criar evento.
- A página principal do catálogo possui assets próprios (`catalogo.js` e
  `catalogo.css`), que permanecerão separados.
- O fluxo atual do Pad cria `.warm-pad-toggle` com o texto **Mostrar Pad** e
  `.warm-pad-panel`; o painel é flutuante, não um diálogo modal.
- O botão é criado somente no fluxo de páginas com cifra (`pre`). Nos índices
  com exportação Holyrics, o script inicializa essa exportação e encerra o fluxo
  antes de criar o controle do Pad. A especificação passa a exigir o Pad também
  nos índices.
- Nas cifras, o botão do Pad tem `z-index: 210`, abaixo da barra de tom sticky
  (`z-index: 250`), causa provável da sobreposição. Nos índices há controles de
  exportação no canto superior direito; o novo botão deve ser integrado à área
  de ações em vez de somente elevar sua camada visual.
- O gerador do catálogo inclui pastas de primeiro nível com `index.html`, com
  exceção das pastas explicitamente ignoradas. O usuário confirmou migrar todas
  as pastas listadas, inclusive coleções musicais.
- Foram identificados 21 índices de catálogo com CSS embutido em 9 variantes.
  Não há JavaScript embutido nesses índices nem blocos embutidos nas 123 cifras
  individuais examinadas.
- A exportação Holyrics existe em 13 dos 21 índices atuais; a decisão é
  disponibilizá-la em todos os índices atuais e futuros.
- A marcação visual `Revisado` existe em apenas dois índices. O CSS será
  central, mas os links continuarão marcados somente quando explicitamente
  aprovados como revisados.
- O gerenciador já cria/remove links de capo; a decisão é disponibilizar estilo
  e exibição em todos os índices apenas para capos configurados.

## Direção proposta

Mover o comportamento compartilhado dos índices e cifras para um par central em
`assets/`, atualizar as referências de todas as pastas listadas pelo catálogo e
alterar o CRUD/modelo para não copiar esses assets por evento. Usar query de
versão (`?v=...`) nas URLs. Manter funcionalidades específicas condicionadas ao
tipo/elementos da página; não ativar em todas as páginas por padrão.

O catálogo principal deve continuar com seu JavaScript/CSS próprio. Não se deve
misturar funcionalidades distintas somente para obter um único par de arquivos
físicos.

Os controles de navegação por estrofes e ajuste da fonte já disponíveis em
“Pergunte aos Animais - Musical” são recursos de leitura de cifras e devem ser
compartilhados pelo carregador central. Carregá-los somente após a variante
renderizar a cifra; não inicializá-los em índices. Remover a implementação
duplicada da variante 9 e manter no CSS comum o destaque da estrofe selecionada.
Preservar navegação por ↑/↓ e Escape, limites de 75–200% em passos de 5%,
persistência da fonte e compatibilidade com a preferência legada da cifra de
referência.

Conforme decisão registrada em `requirements.md`, mover G1–G5 e G7–G9 para o CSS
central, mesclando regras sem eliminar diferenças necessárias. Em G6, manter
embutidos somente os estilos próprios da liturgia/hinos e centralizar os estilos
comuns de exportação/controles. Seletores e classes devem corresponder somente
às estruturas que os utilizam; preservar estrutura e conteúdo específicos dos
índices.

A exportação Holyrics deve ser adicionada a todos os índices, com seu fluxo de
exportação restrito a índices. A marcação de revisão e os links de capo não
devem ser inferidos nem criados sem dados explícitos.

## Pad

O usuário confirmou manter o painel flutuante existente e mostrar o botão nos
índices e cifras. Integrar o botão junto à exportação nos índices e junto aos
controles de tom nas cifras, em vez de depender de sobreposição na faixa
superior. Manter os controles do Pad atuais; não converter o painel em modal.
Garantir que o painel e os demais menus não cubram as ações e que o layout
permaneça utilizável em telas estreitas.

## Superfícies prováveis de implementação

- referências HTML nos índices e nas cifras das pastas abrangidas;
- `event_manager.py`, seu modelo de referência e templates de cifra;
- as variantes CSS embutidas nos índices, conforme a decisão dos grupos G1–G9;
- testes do gerenciador, do catálogo e dos comportamentos afetados;
- documentação diretamente relacionada ao fluxo de criação de evento.

## Verificação proposta

- Executar testes direcionados do gerenciador e do catálogo.
- Validar que índices e cifras em subpastas resolvem corretamente os recursos
  centrais.
- Inspecionar uma amostra de cifra e índice de cada forma de página abrangida.
- Confirmar que o controle do Pad aparece junto à área de ações dos índices e
  às barras de tom das cifras, inclusive quando elas ficam sticky.
- Verificar que não restam cópias independentes dos assets nas pastas
  abrangidas.
- Validar que exportação existe em todos os índices; selo de revisão e capos
  aparecem somente quando há marcação/configuração explícita.
