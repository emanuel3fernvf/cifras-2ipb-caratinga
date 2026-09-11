# Projeto técnico — revisão de palavras na exportação para o Holyrics

## Fluxo proposto

```text
Botão de download
  -> escolha do modo (letra ou cifra comentada)
  -> carregar e interpretar todas as músicas
  -> coletar tokens com "-" ou "_" nas linhas de letra
  -> abrir modal com a opção original selecionada
  -> usuário cancela OU confirma
  -> aplicar as correções selecionadas
  -> montar o JSON existente
  -> baixar
```

A coleta deve acontecer antes do modal para que erros de rede ou parsing não
permitam confirmar uma exportação parcial. A geração e o download ficam adiados
até a ação explícita **Baixar**.

## Modelo de dados transitório

Uma exportação em andamento pode manter:

```js
{
  mode: "letra" | "cifra",
  songs: [/* músicas já interpretadas */],
  reviewItems: [
    {
      source: "Espera----rei",
      corrected: "Esperarei",
      useCorrected: false
    }
  ]
}
```

`reviewItems` é deduplicado por igualdade exata de `source`. O estado nasce com
`useCorrected: false` e é descartado ao cancelar ou ao concluir o download.

## Separação de responsabilidades

- **Coleta:** percorre somente linhas de letra elegíveis, tokeniza por whitespace
  e reúne tokens que contenham `-` ou `_`.
- **Apresentação:** renderiza o modal e controla seleção, foco, cancelamento e
  confirmação.
- **Transformação:** recebe o conjunto de tokens aprovados e substitui apenas
  ocorrências exatas durante o processamento das linhas de letra.
- **Exportação:** conserva a montagem atual do objeto Holyrics e o download do
  JSON.

A transformação antiga baseada em `HOLYRICS_HYPHEN_WORDS` deve ser eliminada. A
função que limpa letras não deve manter comportamento automático equivalente com
outro nome.

## Correspondência segura

A substituição deve operar pelos mesmos tokens delimitados por whitespace usados
na coleta, e não por `replace` de substring global. Isso evita, por exemplo, que
uma decisão sobre `rei--` altere parte de `espera-rei--`. Como a pontuação faz
parte do token, `Rei--` e `Rei--,` são itens diferentes e recebem decisões
independentes.

Somente linhas de letra passam pela substituição. Linhas de cifras comentadas não
devem sofrer remoção de `-` ou `_`.

## Modal e acessibilidade

O componente deve usar semântica de diálogo modal (`role="dialog"`,
`aria-modal="true"` e nome acessível). As duas alternativas de cada card devem
ser expostas como uma escolha única, por exemplo radio buttons estilizados como
botões.

O backdrop intercepta o clique, mas não fecha o diálogo. Ao abrir, o foco vai
para o título/primeiro controle adequado; `Tab` e `Shift+Tab` permanecem no
modal. **Cancelar**, `Escape` e **Baixar** restauram o foco ao elemento que
iniciou a escolha do modo.

O layout dos cards deve usar container flexível ou grid responsivo com wrap,
larguras limitadas a `100%`, quebra de palavras longas e rolagem vertical interna
para listas extensas. O fundo da página não deve rolar enquanto o modal estiver
aberto.

## Escopo no repositório

O comportamento compartilhado deve ser atualizado primeiro em
`_referencia_evento`, fonte dos novos eventos. Como os eventos mantêm cópias
próprias de `index.js` e `index.html`, a implementação deve também ser propagada
para todos os índices existentes que oferecem a exportação para Holyrics, para
evitar comportamentos diferentes conforme a data do evento.

Essa propagação deve se limitar ao bloco de exportação e aos elementos/estilos do
modal, preservando particularidades não relacionadas de cada evento.

## Verificação proposta

- testes unitários da coleta, deduplicação e transformação por token;
- teste dos dois modos de exportação com a mesma seleção;
- teste de hífen ortográfico preservado por padrão;
- teste combinando traços e underlines no mesmo token;
- teste de pontuação e tokens parecidos, mas não idênticos;
- teste de cancelamento, clique no backdrop, `Escape` e restauração de foco;
- teste sem itens revisáveis e com lista extensa;
- inspeção responsiva em largura móvel e desktop;
- comparação estrutural do JSON antes/depois quando nenhuma correção é escolhida,
  exceto pelo comportamento antigo de remoção automática, que deixa de existir.

## Riscos e mitigação

- **Evento antigo conservar a regra automática:** inventariar e atualizar todas
  as cópias que contêm o exportador, não apenas o template.
- **Substituição parcial de outra palavra:** transformar por token exato.
- **Perda de escolha após o carregamento:** abrir o modal somente depois de todas
  as músicas estarem disponíveis e manter um único estado da operação.
- **Lista grande tornar o modal inutilizável:** rolagem interna, wrap e ações
  acessíveis.
- **Regressão no modo com cifras:** aplicar escolhas exclusivamente em linhas de
  letra e preservar comentários de acordes.
