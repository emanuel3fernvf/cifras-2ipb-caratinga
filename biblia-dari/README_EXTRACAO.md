# Extração Automática da Bíblia em Dari

Scripts para extrair todos os capítulos da Bíblia em Dari do site afghanbibles.org e converter para formato Zefania XML.

## Arquivos

- **`extract_all_chapters.py`** - Script principal para extrair todos os capítulos automaticamente
- **`html_to_zefania.py`** - Script para converter os arquivos HTML em XML Zefania
- **`dari-bible-chapters/`** - Diretório onde os capítulos HTML são salvos
- **`extraction_progress.json`** - Arquivo de progresso (criado automaticamente)

## Dependências

Instale as dependências necessárias:

```bash
pip3 install requests beautifulsoup4
```

Ou:

```bash
pip3 install -r requirements.txt
```

## Como Usar

### 1. Extrair todos os capítulos

Execute o script de extração:

```bash
python3 extract_all_chapters.py
```

O script irá:
- Processar todos os capítulos automaticamente em sequência
- Salvar o progresso continuamente (pode ser interrompido e retomado)
- Salvar cada capítulo em `dari-bible-chapters/`
- Mostrar estatísticas de progresso

**Nota:** O processo pode levar bastante tempo (há mais de 1000 capítulos). Você pode interromper com `Ctrl+C` e retomar depois - o script continuará de onde parou.

### 2. Gerar XML Zefania

Após extrair todos os capítulos, gere o XML Zefania:

```bash
python3 html_to_zefania.py
```

Isso criará o arquivo `biblia-dari-zefania.xml` que pode ser importado no Holyrics.

## Características

- ✅ Extração automática completa
- ✅ Salva progresso continuamente
- ✅ Pode ser interrompido e retomado
- ✅ Tratamento de erros
- ✅ Estatísticas de progresso
- ✅ Não sobrecarrega o servidor (pausa de 1 segundo entre requisições)

## Estrutura dos Arquivos

```
.
├── extract_all_chapters.py      # Script de extração
├── html_to_zefania.py           # Script de conversão
├── extraction_progress.json      # Progresso (auto-criado)
├── biblia-dari-zefania.xml      # XML final (gerado)
└── dari-bible-chapters/         # Capítulos HTML
    ├── genesis-1.html
    ├── genesis-2.html
    └── ...
```

## Troubleshooting

### Erro: "ModuleNotFoundError: No module named 'requests'"
Instale as dependências: `pip3 install requests beautifulsoup4`

### Erro: "Connection timeout"
O servidor pode estar sobrecarregado. Aguarde alguns minutos e execute novamente - o script continuará de onde parou.

### Capítulos duplicados
O script verifica automaticamente se um capítulo já foi processado e pula se necessário.

## Status

- ✅ Script de extração criado
- ✅ Script de conversão para XML criado
- ⏳ Aguardando execução para extrair todos os capítulos
