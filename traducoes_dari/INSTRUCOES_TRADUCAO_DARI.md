# Instruções para Tradução de Músicas para Dari

Este documento descreve o processo completo para traduzir músicas do português para Dari (Persa do Afeganistão) usando Google Gemini e formatá-las para uso no Holyrics.

## Estrutura de Arquivos e Pastas

O projeto está organizado em duas pastas principais:

- **`traducoes_dari/musicas_portugues_dari/`** - Contém os arquivos finais com músicas em português e tradução em Dari
- **`traducoes_dari/traducoes/`** - Contém os arquivos com traduções copiadas do Google Gemini (para referência)

Para cada música, são criados **2 arquivos**:

1. **`traducoes_dari/musicas_portugues_dari/<Nome da Música> - <Artista> - Dari.txt`** - Arquivo principal com a música em português (será preenchido com traduções)
2. **`traducoes_dari/traducoes/<Nome da Música> copiado do google gemini tradução.txt`** - Arquivo para colar a tradução completa do Google Gemini

## Processo Passo a Passo

### Passo 1: Criar os Arquivos

Criar os dois arquivos para cada música:

**Arquivo Principal (`traducoes_dari/musicas_portugues_dari/<Nome> - <Artista> - Dari.txt`):**
- Primeira linha: Título da música
- Segunda linha: Nome do artista/grupo
- Terceira linha: Linha em branco
- Resto: Letra completa da música em português, com cada verso em uma linha separada

**Arquivo de Tradução (`traducoes_dari/traducoes/<Nome> copiado do google gemini tradução.txt`):**
- Arquivo vazio inicialmente
- Será preenchido com a tradução do Google Gemini

### Passo 2: Obter Tradução do Google Gemini

1. Acessar o Google Gemini (https://gemini.google.com)
2. Solicitar a tradução da música para Dari (Persa do Afeganistão)
3. Pedir que mantenha:
   - O contexto cristão/louvor
   - A poesia e ritmo musical
   - A emoção e significado espiritual
4. Copiar toda a resposta do Gemini (incluindo texto explicativo e traduções)
5. Colar no arquivo `traducoes_dari/traducoes/<Nome> copiado do google gemini tradução.txt`

### Passo 3: Extrair o Título em Dari

No arquivo de tradução do Gemini, procurar pelo título em Dari. Geralmente aparece assim:
- `### <Título em Dari> (<Título em Português>)`
- Ou na primeira linha após o título em português

**Exemplos:**
- `### شگفت‌انگیز - چقدر زیبا هستی (Maravilhoso / Quão Formoso És)` → Título em Dari: `شگفت‌انگیز - چقدر زیبا هستی`
- `### خداوند را تهلیل کنید (Aclame ao Senhor)` → Título em Dari: `خداوند را تهلیل کنید`
- `### بی‌نظیر (Incomparável)` → Título em Dari: `بی‌نظیر`

### Passo 4: Mapear Traduções para Cada Verso

No arquivo de tradução do Gemini, as traduções aparecem no formato:
```
**Verso em português**
Tradução em Dari
```

**Importante:** Manter a ordem exata da música original. Se um verso se repete, usar a mesma tradução todas as vezes.

### Passo 5: Formatar o Arquivo Principal

Atualizar o arquivo `traducoes_dari/musicas_portugues_dari/<Nome> - <Artista> - Dari.txt` seguindo este formato:

1. **Título:** Adicionar título em Dari entre parênteses após o título original
   ```
   Maravilhoso (Quão Formoso És) (شگفت‌انگیز - چقدر زیبا هستی)
   ```

2. **Estrutura de cada verso:**
   - Verso em português
   - Tradução em Dari (na linha seguinte)
   - Linha em branco (separando parágrafos)

**Exemplo:**
```
Quão formoso és, rei do universo
چقدر زیبا هستی، ای پادشاه کائنات

Tua glória enche a terra e enche o céu
جلال تو زمین و آسمان را پر می‌کند
```

### Passo 6: Regras Importantes

- **Cada verso e sua tradução formam um parágrafo separado** (isolado por quebras de linha)
- **Manter a ordem exata** da música original
- **Versos repetidos** devem ter suas traduções repetidas também
- **Interjeições** como "Oh, oh, oh" podem ficar sem tradução se não houver tradução no Gemini
- **Título em Dari** sempre entre parênteses após o título original

### Passo 7: Verificação Final

Antes de finalizar, verificar:
- [ ] Título em Dari está presente entre parênteses
- [ ] Cada verso tem sua tradução logo abaixo
- [ ] Parágrafos estão separados por linhas em branco
- [ ] Ordem da música foi mantida
- [ ] Todos os versos foram traduzidos (incluindo repetições)

## Exemplo Completo

**Arquivo Original:**
```
Maravilhoso
Corinhos Evangélicos

Quão formoso és, rei do universo
Tua glória enche a terra e enche o céu
```

**Arquivo Final Formatado:**
```
Maravilhoso (Quão Formoso És) (شگفت‌انگیز - چقدر زیبا هستی)
Corinhos Evangélicos

Quão formoso és, rei do universo
چقدر زیبا هستی، ای پادشاه کائنات

Tua glória enche a terra e enche o céu
جلال تو زمین و آسمان را پر می‌کند
```

## Formato para Holyrics

O formato final está pronto para ser colado diretamente no Holyrics:
- Cada verso em português seguido de sua tradução em Dari
- Cada par (verso + tradução) é um parágrafo separado
- Facilita a exibição bilingue durante os cultos

## Notas Adicionais

- O Google Gemini geralmente fornece traduções contextuais e poéticas adequadas para música cristã
- Se alguma tradução parecer inadequada, pode-se pedir ao Gemini para revisar ou ajustar
- Manter sempre os arquivos de tradução do Gemini como referência para futuras consultas

## Prompt Sugerido para o Google Gemini

Ao solicitar a tradução, usar um prompt como este:

```
Traduza a seguinte música cristã para Dari (Persa do Afeganistão), mantendo:
- O contexto cristão/louvor
- A poesia e ritmo musical
- A emoção e significado espiritual

[COLAR AQUI A LETRA COMPLETA DA MÚSICA]

Forneça a tradução com cada verso em português seguido de sua tradução em Dari.
```
