# Revisão de palavras na exportação para o Holyrics

## Contexto

A exportação para o Holyrics remove automaticamente traços usados para prolongar
sílabas nas letras. Hoje essa decisão depende de uma lista manual de palavras com
hífen ortográfico e de um comentário que instrui agentes de IA a manter essa
lista. Isso pode alterar a letra sem que o usuário veja ou aprove a mudança e não
contempla prolongamentos escritos com underline (`_`).

## Objetivo

Substituir a decisão automática e a manutenção por IA por uma etapa visual de
revisão. Antes de gerar o JSON, o usuário deve escolher, para cada palavra com
traço ou underline, entre preservar o texto da fonte e usar uma versão corrigida
pela remoção desses caracteres.

## Requisitos funcionais

### RF-01 — Remover o tratamento mantido por IA

A exportação não deve depender de allowlist ou dicionário de palavras com hífen.
Devem ser removidos tanto a estrutura usada para essa lista quanto os comentários
que orientam IA/agentes a incluir, preservar ou revisar suas entradas.

Nenhuma decisão linguística deve ser tomada automaticamente para distinguir
hífen ortográfico de caractere de prolongamento.

### RF-02 — Momento de abertura

Ao acionar o botão de download e escolher **Exportar somente letras** ou
**Exportar com cifras comentadas**, o sistema deve carregar as músicas do evento,
identificar as palavras revisáveis e abrir o modal antes de gerar ou baixar o
arquivo.

O modo escolhido deve ser preservado durante toda a revisão e aplicado à geração
do JSON após a confirmação.

### RF-03 — Identificação das palavras revisáveis

Devem ser consideradas revisáveis as palavras das linhas de letra que contenham
ao menos um dos caracteres ASCII:

- traço/hífen (`-`);
- underline (`_`).

Linhas reconhecidas como cifras e linhas descartadas pelas regras atuais da
exportação não devem originar cards. A identificação deve ocorrer sobre o mesmo
conteúdo que será exportado, abrangendo todas as músicas do índice.

Para esta funcionalidade, “palavra” é um token não vazio delimitado por espaço ou
quebra de linha. A pontuação ligada ao token deve continuar visível nas opções e
ser preservada no arquivo; somente `-` e `_` são removidos na opção corrigida.

Exemplos:

| Texto da fonte | Opção corrigida |
| --- | --- |
| `Espera----rei` | `Esperarei` |
| `Alelu___ia!` | `Aleluia!` |
| `amá-lo` | `amálo` |
| `Rei-_no` | `Reino` |

### RF-04 — Agrupamento de ocorrências

Tokens exatamente iguais, incluindo maiúsculas, minúsculas, acentos, pontuação e
quantidade de separadores, devem aparecer em um único card. A escolha desse card
deve ser aplicada a todas as ocorrências idênticas em todas as músicas exportadas.
Tokens diferentes devem permanecer independentes.

### RF-05 — Conteúdo e seleção dos cards

Cada card deve apresentar duas opções mutuamente exclusivas e integralmente
clicáveis:

1. a palavra exatamente como veio da fonte;
2. a palavra corrigida, obtida apenas removendo todos os caracteres `-` e `_`.

A opção original deve aparecer selecionada por padrão. A aparência selecionada
deve ser equivalente à de um botão ativo e não pode depender somente de cor.
Alterar uma escolha deve atualizar imediatamente o estado visual do card, sem
fechar o modal.

### RF-06 — Layout responsivo

Os cards devem ser organizados em colunas e quebrar para novas linhas (`wrap`)
quando não houver espaço horizontal. O modal e seus cards não podem ultrapassar a
largura da viewport. Em telas estreitas, os cards podem ocupar uma coluna.

Quando o conteúdo exceder a altura disponível, o corpo do modal deve possuir
rolagem, mantendo as ações de confirmação acessíveis.

Palavras longas devem quebrar internamente sem provocar rolagem horizontal da
página ou estouro do card.

### RF-07 — Comportamento do modal

O modal deve:

- possuir título que explique a revisão das palavras;
- bloquear a interação com a página ao fundo;
- não fechar ao clicar no backdrop/fora de seu conteúdo;
- oferecer uma ação explícita **Cancelar** para fechar sem baixar;
- oferecer uma ação primária **Baixar** para confirmar as escolhas e gerar o
  arquivo;
- manter o foco dentro dele enquanto aberto e devolver o foco à opção de
  exportação que o abriu ao ser fechado.

A tecla `Escape` pode executar a mesma ação de **Cancelar**; clicar fora nunca
deve cancelar nem confirmar a operação.

### RF-08 — Aplicação das escolhas

Ao confirmar, a exportação deve substituir somente as ocorrências cujos cards
estejam com a opção corrigida selecionada. As demais devem permanecer idênticas à
fonte, inclusive palavras com hífen ortográfico como `amá-lo`.

As escolhas devem ser aplicadas apenas à exportação em andamento. Elas não devem
alterar os arquivos HTML das cifras nem ficar persistidas para uma exportação
futura.

Fora da substituição escolhida, devem permanecer as regras atuais dos dois modos,
o formato do JSON do Holyrics, metadados, parágrafos, IDs e nome do arquivo.

### RF-09 — Nenhuma palavra encontrada

Se não houver palavras revisáveis, o modal ainda deve informar que nenhuma foi
encontrada e disponibilizar **Cancelar** e **Baixar**. Confirmar deve gerar o
arquivo normalmente, sem substituições.

### RF-10 — Falhas antes do modal

As validações existentes para índice sem músicas, uso via `file:` e falha ao
carregar uma cifra devem continuar impedindo o download e exibindo erro. Se a
coleta não puder ser concluída, o modal de revisão não deve apresentar uma lista
parcial como se estivesse completa.

## Critérios de aceite

1. As duas opções existentes do menu iniciam a coleta e abrem o modal antes de
   qualquer download.
2. Clicar fora do modal não o fecha; **Cancelar** fecha sem gerar arquivo.
3. Cada token com `-` ou `_` possui opção original, selecionada inicialmente, e
   opção corrigida sem esses caracteres.
4. Manter todas as escolhas padrão produz letras idênticas à fonte quanto a
   traços e underlines.
5. Selecionar `Esperarei` para `Espera----rei` substitui todas as ocorrências
   idênticas no JSON e não altera os HTMLs de origem.
6. Uma escolha feita para uma palavra não afeta tokens diferentes.
7. O modo **somente letras** continua omitindo cifras e o modo **cifras
   comentadas** continua incluindo-as no formato atual.
8. Os cards fazem wrap e não causam overflow horizontal em viewport móvel ou
   desktop.
9. A allowlist atual e o comentário dirigido à IA/agentes deixam de existir no
   fluxo de referência e nas cópias da exportação que receberem a funcionalidade.
10. Quando não há palavras revisáveis, o usuário ainda consegue confirmar e
    baixar o arquivo.

## Fora de escopo

- corrigir ortografia, acentuação ou pontuação;
- sugerir palavras por IA ou consultar dicionários;
- editar a cifra de origem a partir do modal;
- persistir escolhas entre exportações;
- alterar o schema de importação do Holyrics;
- reconhecer variantes Unicode parecidas com traço ou underline.

## Estado da especificação

**Proposta — somente documentação; nenhuma alteração funcional foi realizada.**
