# Novo Cântico → JSON (Holyrics)

Script para baixar todos os hinos do [Índice por Assunto](https://novocantico.com.br/indice/assunto/) do Novo Cântico, extrair letra e coro e gerar um único arquivo JSON no formato usado pelo Holyrics (compatível com arquivos como `2026-02-09_23-08-55.json`).

## Regras de formatação

- **Painel:** De cada página é usado apenas o **primeiro** elemento com classe `.panel.panel-default` (o que contém o hino).
- **Coro:** Se existir elemento com classe `.coro.list-unstyled`, o coro é extraído de dentro da primeira estrofe e repetido **após cada estrofe**.
- **Solo:** Antes da **última estrofe** (o coro não conta como última) é inserido um parágrafo com o texto: `🎶🎵🎶🎵🎶🎵🎶`.
- **Artist:** Em todos os hinos o campo `artist` é preenchido com `Hinário Novo Cântico`.

## Uso

Em muitos sistemas (ex.: Ubuntu/Debian) o `pip install` direto dá erro *externally-managed-environment*. Use um **ambiente virtual**:

```bash
cd novo-cantico

# Se der erro "venv not found", instale antes:
#   sudo apt install python3.12-venv   (ou python3-venv)

python3 -m venv .venv
source .venv/bin/activate   # no Windows: .venv\Scripts\activate
pip install -r requirements.txt
python scrape_novo_cantico.py
```

Ou, em uma linha (Linux/macOS), após criar o venv uma vez:

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/python scrape_novo_cantico.py
```

O script:

1. Acessa `https://novocantico.com.br/indice/assunto/` e coleta todos os links de hinos.
2. Para cada link, acessa a página do hino (HTML ou XML).
3. Extrai o primeiro `.panel.panel-default` (ou, em XML, as tags `estrofe`/`coro`).
4. Monta os parágrafos com estrofes, coro (quando houver) e o bloco de solo antes da última estrofe.
5. Gera um JSON no formato do Holyrics e salva na pasta `novo-cantico` com nome no formato `YYYY-MM-DD_HH-MM-SS.json`.

## Estrutura do JSON gerado

Cada hino segue o mesmo esquema do exemplo em `../2026-02-09_23-08-55.json`:

- `id`, `title`, `artist` (= "Hinário Novo Cântico"), `author`, `note`, `copyright`, `language`, `key`, `bpm`, `time_sig`, `midi`, `order`, `arrangements`
- `lyrics.full_text`: texto completo das estrofes (e coros) separados por `\n\n`
- `lyrics.paragraphs`: lista de objetos com `number`, `description`, `text`, `text_with_comment`, `translations`
- `streaming`, `extras`

## Requisitos

- Python 3.7+
- Pacotes: `requests`, `beautifulsoup4`, `lxml` (ver `requirements.txt`)
- Para criar o ambiente virtual: `python3-venv` (em Ubuntu/Debian: `sudo apt install python3.12-venv`)

## Observações

- O site pode servir o hino em HTML (com `.panel.panel-default`) ou em XML; o script tenta os dois.
- É usado um pequeno delay entre requisições para não sobrecarregar o servidor.
- Falhas de rede ou páginas inacessíveis são registradas e o script continua com os próximos hinos.
