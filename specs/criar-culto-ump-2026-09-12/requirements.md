# Culto da UMP — 12/09/2026

## Contexto

É necessário cadastrar no catálogo de cifras o culto da UMP de 12 de setembro
de 2026, usando o CRUD e o modelo de eventos já existentes no projeto.

## Objetivo

Criar o evento **Culto da UMP**, com data **12/09/2026**, e cadastrar as cinco
músicas na ordem definida para o culto.

## Requisitos funcionais

### RF-01 — Evento

O evento deve usar a pasta `2026_09_12`, exibir o título **Culto da UMP** e o
subtítulo **12/09/2026**.

### RF-02 — Repertório e ordem

O índice deve apresentar, nesta ordem:

1. 130 — Projeto Sola;
2. Salmo 139 — João Manô;
3. Meia Noite — FHOP;
4. Hosana — Hillsong;
5. Redenção — Projeto Sola.

### RF-03 — Cifra vazia

A cifra de **Redenção** deve ser criada somente com título e artista, deixando o
corpo vazio para preenchimento futuro.

### RF-04 — Reaproveitamento de Meia Noite

A cifra **Meia Noite — FHOP** deve reutilizar o conteúdo já disponível no evento
`2026_05_31`, sem alterar o arquivo de origem.

### RF-04A — Reaproveitamento das demais cifras disponíveis

As versões mais recentes e compatíveis de **130**, **Salmo 139** e **Hosana**
devem ser copiadas, respectivamente, dos eventos `2026_08_16`, `2026_06_21` e
`2026_06_27`, sem alterar os arquivos de origem.

### RF-05 — Catálogo

O novo evento e suas músicas devem constar em `catalogo.json` após a atualização
realizada pelo fluxo de gerenciamento.

### RF-06 — Navegação entre cifras

Todas as cifras devem oferecer retorno ao índice do evento. As quatro primeiras
também devem apontar para a próxima música do repertório, sem conservar links
dos eventos usados como fonte.

## Critérios de aceite

1. A pasta `2026_09_12` contém `index.html`, `index.css`, `index.js` e as cinco
   páginas de música.
2. O índice identifica o culto e apresenta as músicas na ordem solicitada.
3. Somente “Redenção” permanece com o corpo vazio do template.
4. “130”, “Salmo 139”, “Meia Noite” e “Hosana” contêm as cifras previamente
   cadastradas.
5. O catálogo referencia o evento e todos os arquivos sem links quebrados.
6. Os botões de próxima música seguem a ordem do índice e todos os botões de
   retorno abrem `2026_09_12/index.html`.

## Fora de escopo

- preencher a cifra de “Redenção”, ainda não disponível no projeto;
- alterar letras, acordes ou formatação de “Meia Noite”;
- adicionar links do YouTube ou capotrastes.

## Estado da especificação

**Aprovada pelo pedido e implementada juntamente com esta especificação.**
