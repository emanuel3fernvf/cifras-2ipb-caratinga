# Especificação: recursos compartilhados do catálogo e acesso ao Pad

## Estado

**Fechada e implementada após ordem explícita do usuário.**
Escopo, comportamento e critérios de aceite foram confirmados.

## Contexto

Antes da implementação, as páginas de índice e as cifras dentro das pastas do
catálogo referenciavam arquivos `index.js` e `index.css` locais. O CRUD também
copiava esses arquivos ao criar um evento. A página principal `catalogo.html`,
por sua vez, possui `catalogo.js` e `catalogo.css` próprios e ficará separada.

O JavaScript atual cria um botão **Mostrar Pad** e um painel flutuante, não um
modal. O painel será mantido. O usuário pediu que o controle do Pad apareça nos
índices de evento e nas cifras individuais, integrado à área de controles para
não disputar espaço com exportação ou transposição.

## Decisões confirmadas

- Centralizar em `assets/` os recursos das páginas de todas as pastas incluídas
  no catálogo, existentes e futuras, inclusive pastas não nomeadas por data.
- Atualizar também o modelo de referência usado pelo CRUD, sem manter cópias
  `index.js`/`index.css` por pasta.
- Manter `catalogo.html`, `catalogo.js` e `catalogo.css` fora da centralização.
- Usar query de versão (`?v=...`) nas referências centrais para atualização de
  cache.
- Exibir o Pad nos índices e nas cifras, manter o painel atual e posicionar o
  botão na área de controles: ao lado da exportação nos índices e junto aos
  controles de tom nas cifras.
- Adicionar a exportação Holyrics a todos os índices do catálogo, atuais e
  futuros; ela não aparece nas páginas individuais de cifra.
- O estilo do selo **Revisado** deve ficar disponível em todos os índices, mas
  o selo só aparece em músicas explicitamente marcadas como revisadas.
- Exibir e estilizar links de capo em todos os índices quando houver capos
  configurados para a música. Não criar capos automaticamente.
- Centralizar o código não torna todas as funcionalidades universais. Cada
  função deve ser ativada somente conforme estas decisões e a estrutura da
  página.
- Avaliar CSS embutido caso a caso, agrupando blocos idênticos para evitar
  decisões repetidas. A página de cifra não apresentou CSS ou JavaScript
  embutido na amostra completa de 123 cifras do catálogo.
- Ao concluir e fechar a especificação, parar sem implementar. A implementação
  só começa mediante ordem explícita do usuário.

## Objetivo

Centralizar em `assets/` os arquivos JavaScript e CSS usados pelos índices e
cifras das pastas listadas no catálogo, eliminando cópias independentes desses
arquivos por pasta. Corrigir o acesso ao Pad integrando o botão às áreas de
controle e garantindo sua exibição tanto nos índices quanto nas cifras.

## Requisitos funcionais

### RF-01 — Recursos compartilhados

Os índices e cifras de todas as pastas incluídas no catálogo devem carregar
JavaScript e CSS de `assets/`, em vez de depender de arquivos próprios em cada
pasta. O CRUD e o modelo de referência devem gerar novas páginas com referências
para os recursos compartilhados.

### RF-02 — Migração e remoção das cópias

As pastas incluídas no catálogo não devem manter cópias independentes de
`index.js` ou `index.css`. Índices e cifras devem continuar funcionando após a
migração, inclusive quando publicados em subpastas no GitHub Pages.

### RF-03 — Preservação de comportamento

A centralização não deve remover nem alterar inadvertidamente os comportamentos
atuais das cifras e índices abrangidos, incluindo navegação, transposição,
rolagem, edição local, exportação e autenticação quando aplicáveis. Recursos
específicos devem continuar restritos às páginas que os suportam.

### RF-04 — Catálogo principal

`catalogo.html`, `catalogo.js` e `catalogo.css` permanecem separados dos
recursos centrais usados dentro das pastas do catálogo.

### RF-05 — Botão e interface do Pad

O botão para abrir o Pad deve ficar visível, acessível e acionável nos índices
de evento e nas cifras individuais. Nos índices, deve integrar a área de
exportação; nas cifras, a área de controles de tom. Não deve ficar encoberto nem
sobrepor controles adjacentes.

A interface aberta continua sendo o painel flutuante existente, preservando
seus controles e comportamento, em vez de se tornar um modal. Deve permanecer
utilizável em telas estreitas e por teclado.

### RF-06 — Cache dos arquivos compartilhados

As referências aos recursos centrais devem permitir que versões atualizadas
sejam carregadas sem manter uma versão antiga em cache após uma publicação.
As URLs devem usar query de versão (`?v=...`), atualizada junto com a publicação
dos recursos.

### RF-07 — CSS embutido nos índices

As variantes aprovadas para centralização devem ser movidas para o CSS central,
preservando sua aplicação apenas às estruturas que as utilizam. Em G6, somente
os estilos próprios da liturgia/hinos permanecem embutidos; as regras de
exportação e controles comuns são movidas para o CSS central. As decisões são:

| Grupo | Pastas | Conteúdo visual principal | Decisão |
|---|---|---|---|
| G1 | `17-e-18-de-outubro`, `2026_08_30`, `2026_09_06`, `2026_10_04`, `2026_10_29`, `2026_11_01`, `nivel-1`, `pergunte-aos-animais-musical` | Base moderna, linhas gerenciadas, exportação e modal de revisão | Centralizar; disponibilizar exportação em todos os índices |
| G2 | `2026_06_27`, `2026_07_05_DOM`, `2026_07_11_UMP` | Layout legado com título de seção e links de música | Centralizar, preservando a aplicação por estrutura |
| G3 | `2026_04_19`, `2026_05_31`, `2026_06_21` | Layout simples de links com classes de espaçamento | Centralizar, preservando a aplicação por estrutura |
| G4 | `2026_03_15_DOM`, `musical_pascoa_UMP_2026` | Layout simples com indicação visual de itens revisados | Centralizar; mostrar selo somente em links explicitamente marcados |
| G5 | `2026_07_12_DOM` | Título de seção, linhas de música/capo e exportação com modal de revisão | Centralizar; estilizar capos em todos os índices quando configurados |
| G6 | `2026_09_20` | Repertório litúrgico, hinos e exportação | Manter embutidos somente estilos próprios da liturgia/hinos; centralizar exportação/controles comuns |
| G7 | `2026_09_12` | Repertório litúrgico, linhas gerenciadas e exportação com modal de revisão | Centralizar, preservando a aplicação por estrutura |
| G8 | `2026_08_16` | Repertório litúrgico, linhas de música/capo e exportação com modal | Centralizar; regras só se aplicam onde a estrutura/classe correspondente existe |
| G9 | `2026_08_02` | Repertório litúrgico, linhas de música/capo e exportação com modal | Mesclar no CSS central as regras úteis, preservando diferenças necessárias |

O levantamento encontrou CSS embutido em 21 índices de catálogo, distribuído
nesses 9 grupos, e nenhum JavaScript embutido nesses índices. As cifras
individuais não contêm blocos embutidos de CSS/JavaScript na revisão feita.

### RF-08 — Controles compartilhados de leitura das cifras

Todas as cifras atuais e futuras do catálogo devem oferecer os controles de
leitura que já existiam na variante “Pergunte aos Animais - Musical”. As setas
↑/↓ navegam entre estrofes, destacam e centralizam a estrofe ativa; a navegação
para nas extremidades e Escape remove o destaque. O tamanho do texto deve poder
ser ajustado em passos de 5%, entre 75% e 200%, restaurado a 100% e persistido
no navegador. Os controles de fonte ficam junto à barra de tom. Índices e outras
páginas sem cifra não exibem esses controles.

## Critérios de aceite propostos

1. Índices e cifras de todas as pastas listadas pelo catálogo carregam os
   recursos centrais corretos, independentemente da profundidade da pasta.
2. O fluxo de criação de eventos não produz JavaScript ou CSS específico por
   evento.
3. Não há cópias locais dos recursos centrais nas pastas abrangidas.
4. As funcionalidades exclusivas continuam restritas aos tipos de página
   aprovados para elas.
5. O botão do Pad aparece nos índices e cifras, integrado à área de controles,
   sem ficar encoberto ou sobrepor exportação/transposição; ele abre o painel
   flutuante atual.
6. A exportação Holyrics está disponível em todos os índices atuais e futuros,
   sem aparecer nas cifras individuais.
7. O selo **Revisado** aparece somente nos links marcados explicitamente.
8. Links de capo são exibidos em todos os índices quando configurados e não são
   criados automaticamente.
9. Os testes cobrem caminhos de recursos, criação de evento e comportamentos
   preservados, sem depender de uma única pasta de exemplo.
10. G1–G5, G7–G9 e as regras comuns de G6 estão no CSS central com seletores que
    não alteram páginas sem a estrutura correspondente; somente estilos
    específicos de liturgia/hinos de G6 permanecem embutidos.
11. Todas as cifras carregam os controles compartilhados de leitura; setas,
    destaque, rolagem, limites e persistência de fonte mantêm o comportamento
    existente, enquanto índices não exibem esses controles.

## Fora de escopo provisório

- Alterar letras, acordes, tons ou ordem litúrgica das cifras.
- Redesenhar a página do catálogo sem decisão explícita.
- Remover funcionalidades atuais apenas para simplificar o JavaScript ou CSS.

## Fechamento e implementação

O usuário aprovou o fechamento desta especificação e posteriormente autorizou a
implementação, que foi concluída e validada.
