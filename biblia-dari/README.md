# Bíblia em Dari - Arquivos de Extração

Esta pasta contém todos os arquivos relacionados à extração e conversão da Bíblia em Dari para o formato Zefania XML.

## Estrutura

### Arquivos Principais

- **`biblia-dari-zefania.xml`** - Arquivo XML final no formato Zefania, pronto para importação no Holyrics
- **`extract_all_chapters.py`** - Script principal para extração automática de todos os capítulos
- **`html_to_zefania.py`** - Script para converter os arquivos HTML em XML Zefania
- **`README_EXTRACAO.md`** - Documentação detalhada do processo de extração

### Diretórios

- **`dari-bible-chapters/`** - Contém 1189 arquivos HTML, um para cada capítulo da Bíblia

### Arquivos de Suporte

- **`extraction_progress.json`** - Arquivo de progresso da extração (permite retomar se interrompido)
- **`requirements.txt`** - Dependências Python necessárias
- **`SF_2004-07-28_TUR_BB31_(TURKISH).xml`** - Arquivo de referência usado para validar o formato XML

### Scripts Alternativos

Vários scripts de tentativas anteriores estão incluídos (auto_extract_*.py, extract_*.py, etc.), mas o script principal e funcional é `extract_all_chapters.py`.

## Como Usar

### Extrair Capítulos (se necessário reextrair)

```bash
cd biblia-dari
pip3 install -r requirements.txt
python3 extract_all_chapters.py
```

### Gerar XML Zefania

```bash
cd biblia-dari
python3 html_to_zefania.py
```

O arquivo `biblia-dari-zefania.xml` será gerado/atualizado.

## Importação no Holyrics

O arquivo `biblia-dari-zefania.xml` está pronto para importação no Holyrics:

1. Abra o Holyrics
2. Vá em **Bíblia** > **Importar Bíblia**
3. Selecione o arquivo `biblia-dari-zefania.xml`
4. A Bíblia em Dari será importada e estará disponível para uso

## Status

✅ **Extração Completa**: Todos os 1189 capítulos foram extraídos  
✅ **XML Gerado**: Arquivo Zefania XML válido e testado  
✅ **Formato Validado**: Compatível com Holyrics
