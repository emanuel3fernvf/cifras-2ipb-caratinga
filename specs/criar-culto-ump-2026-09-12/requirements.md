# Culto da UMP — 12/09/2026

## Contexto

É necessário cadastrar no catálogo de cifras o culto da UMP de 12 de setembro
de 2026, usando o CRUD e o modelo de eventos já existentes no projeto.

## Objetivo

Manter o evento **Culto da UMP**, com data **12/09/2026**, e apresentar a
liturgia e as seis músicas na ordem definida para o culto.

## Requisitos funcionais

### RF-01 — Evento

O evento deve usar a pasta `2026_09_12`, exibir o título **Culto da UMP** e o
subtítulo **12/09/2026**.

### RF-02 — Liturgia e repertório

O índice deve apresentar, nesta ordem:

1. Prelúdio e 130 — Projeto Sola;
2. leitura conjunta da doxologia de Romanos 11.33-36;
3. momento de gratidão, com oração de gratidão;
4. Hino 107 — Ao Pé da Cruz;
5. momento de arrependimento, com leitura do Salmo 139.23-24;
6. oração de arrependimento e momento do louvor;
7. canções: Salmo 139, Meia Noite, Redenção e Hosana;
8. passagem para a mensagem do pregador.

### RF-03 — Reaproveitamento de Ao Pé da Cruz

A cifra **Ao Pé da Cruz — Ipalpha** deve reutilizar o conteúdo disponível no
evento `2026_09_06`, exibindo no índice o nome litúrgico **Hino 107 — Ao Pé da
Cruz**, sem alterar o arquivo de origem.

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

1. A pasta `2026_09_12` contém `index.html`, `index.css`, `index.js` e as seis
   páginas de música.
2. O índice identifica o culto e apresenta a liturgia e as músicas na ordem solicitada.
3. “130”, “Ao Pé da Cruz”, “Salmo 139”, “Meia Noite”, “Redenção” e “Hosana”
   mantêm suas letras e cifras cadastradas.
4. “Ao Pé da Cruz” preserva os metadados de título e artista da página de origem.
5. O catálogo referencia o evento e todos os arquivos sem links quebrados.
6. Os botões de próxima música seguem a ordem do índice e todos os botões de
   retorno abrem `2026_09_12/index.html`.

## Fora de escopo

- alterar letras, acordes ou formatação de “Meia Noite”;
- alterar letras, acordes ou tons das demais cifras;
- adicionar links do YouTube ou capotrastes.

## Estado da especificação

**Aprovada pelo pedido e implementada juntamente com esta especificação.**
