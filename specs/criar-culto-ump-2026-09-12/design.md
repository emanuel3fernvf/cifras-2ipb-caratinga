# Projeto técnico — Culto da UMP de 12/09/2026

## Abordagem

O evento será criado pelas operações de `event_manager.py`, reproduzindo o CRUD
local do projeto:

1. criação por data para gerar `2026_09_12` a partir de `_referencia_evento`;
2. preservação do subtítulo de data criado pelo CRUD e ajuste do título para
   **Culto da UMP** (a validação atual de edição rejeita `/` no subtítulo);
3. criação das cinco músicas na ordem do repertório;
4. substituição das páginas recém-criadas de “130”, “Salmo 139”, “Meia Noite” e
   “Hosana” pelas versões compatíveis mais recentes existentes no projeto;
5. regeneração do catálogo.

## Estado resultante

```text
2026_09_12/
├── index.html
├── index.css
├── index.js
├── 130 - Projeto Sola.html
├── Salmo 139 - João Manô.html
├── Meia Noite - FHOP.html
├── Hosana - Hillsong.html
└── Redenção - Projeto Sola.html
```

O marcador `<!-- MANAGED_SONGS -->` continuará no índice para que o CRUD possa
incluir novas músicas posteriormente. Os recursos compartilhados do evento são
copiados do modelo de referência sem modificações específicas.

## Verificação

- consultar o evento por `list_events()` e conferir título, subtítulo e músicas;
- comparar as quatro cifras reaproveitadas com suas origens;
- confirmar que “Redenção” mantém vazio o corpo do `<pre>`;
- executar os testes do gerenciador e do catálogo.

## Riscos e mitigação

- **Ordem incorreta:** cadastrar sequencialmente na ordem solicitada.
- **Sobrescrever a origem:** copiar sempre dos eventos existentes para o novo
  destino, sem modificar as fontes.
- **Catálogo desatualizado:** regenerá-lo após a cópia e validar seus caminhos.
