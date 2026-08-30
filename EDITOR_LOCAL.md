# Servidor do editor local de cifras

O editor grava arquivos somente quando a página é aberta por este servidor,
vinculado exclusivamente a `127.0.0.1`.

## Iniciar

### Windows 10 e 11

Dê duplo clique em `windows\instalar_e_rodar.bat`. Na primeira execução, ele
procura Python 3.10 ou superior e cria o ambiente local em `windows\venv`. Se Python não estiver
instalado, tenta instalar Python 3.12 com winget; caso isso não seja possível,
abre a página oficial de instalação e mostra as instruções necessárias.

Nas próximas execuções, o mesmo arquivo abre o aplicativo diretamente, sem
manter uma janela de terminal. Depois, o botão de atalho nas configurações cria
um arquivo .lnk na Área de Trabalho do perfil atual, inclusive quando ela é
redirecionada pelo OneDrive.

### Linux

Na raiz do repositório, autorize a execução uma única vez e inicie o aplicativo:

```bash
chmod +x linux/instalar_e_rodar.sh
./linux/instalar_e_rodar.sh
```

O instalador procura Python 3.10 ou superior, cria o ambiente local em
`linux/venv` e abre o aplicativo no navegador. Se o Python não estiver
disponível, ele tenta instalá-lo por `apt`, `dnf` ou `pacman`, conforme a
distribuição. Nas execuções seguintes, basta executar novamente o mesmo `.sh`.

Depois, abra <http://127.0.0.1:8000/configuracoes.html>. Nessa página é
possível abrir qualquer pasta que contenha `index.html`, criar o atalho na
área de trabalho, verificar o status e desligar o servidor com segurança.

Para usar outra porta ou
servir uma cópia isolada em testes:

```bash
python3 local_editor_server.py --port 8765 --root /caminho/da/copia
```

`--port` usa `8000` por padrão. `--root` usa por padrão o diretório em que
`local_editor_server.py` está localizado. `Ctrl+C` encerra o processo.

## Contrato HTTP

Todas as respostas da API são JSON UTF-8, têm `Cache-Control: no-store` e usam
o prefixo `/__chord_editor__/`.

### Verificar o servidor

```http
GET /__chord_editor__/health
```

Resposta `200`:

```json
{"ok":true}
```

### Listar pastas com índice

```http
GET /__chord_editor__/indexes
```

Quando aberto em `127.0.0.1` ou `localhost`, o painel também usa os endpoints
locais `events`, `songs` e `capos` para criar e excluir eventos, cifras e links
de capotraste. Esses controles permanecem ocultos fora do servidor local. As
exclusões de eventos e cifras são movidas para `_lixeira`.

`PUT /__chord_editor__/songs` edita título, artista e vídeo do YouTube de uma
cifra. Se o título ou o artista mudar, o arquivo e seus links de capotraste são
renomeados juntos. `PUT /__chord_editor__/events` edita título, subtítulo e nome
da pasta do evento. Essas operações atualizam o catálogo e revertem os arquivos
se alguma etapa falhar.

### Criar atalho e desligar

Os controles da página usam `POST /__chord_editor__/shortcut` para criar um
arquivo `.lnk` no Windows ou `.desktop` no Linux, e
`POST /__chord_editor__/shutdown` para encerrar o processo. O atalho inicia o
servidor quando necessário e abre as configurações.

### Ler texto e revisão atuais

```http
GET /__chord_editor__/document?path=2026_08_02%2FNome%20da%20M%C3%BAsica.html
```

Resposta `200`:

```json
{
  "ok": true,
  "path": "2026_08_02/Nome da Música.html",
  "preText": "F   G   Am\n...",
  "revision": "sha256-do-arquivo-completo"
}
```

`preText` é texto simples, com entidades HTML já decodificadas. A aplicação
deve usar esse valor e essa revisão como estado inicial canônico.

### Salvar o texto do `<pre>`

```http
POST /__chord_editor__/save
Content-Type: application/json

{
  "path": "2026_08_02/Nome da Música.html",
  "preText": "F  G      Am\n...",
  "expectedRevision": "revisao-recebida-na-ultima-leitura-ou-gravacao"
}
```

Resposta `200`:

```json
{"ok":true,"revision":"nova-revisao-sha256"}
```

O cliente deve adotar a nova revisão depois de cada sucesso. Se o arquivo foi
alterado desde a revisão informada, o servidor responde `409` e não sobrescreve
a alteração externa:

```json
{
  "ok": false,
  "error": {
    "code": "revision_conflict",
    "message": "O arquivo foi alterado; recarregue antes de salvar novamente."
  }
}
```

## Regras de gravação e erros

- `path` é sempre relativo à raiz, usa `/`, precisa terminar em `.html` e não
  pode atravessar a raiz nem apontar por link simbólico para fora dela.
- A página precisa ser UTF-8 e conter exatamente um elemento `<pre>` completo.
- Somente o conteúdo desse `<pre>` é trocado. `<`, `>`, e `&` recebidos em
  `preText` são escapados; todo o restante do arquivo permanece byte a byte.
- A troca usa arquivo temporário no mesmo diretório e `os.replace`, preservando
  as permissões do arquivo original.
- O corpo JSON é limitado a 4 MiB. O servidor não habilita CORS e aceita `Host`
  apenas para `127.0.0.1` ou `localhost`.

Erros usam sempre `{ "ok": false, "error": { "code", "message" } }`.
Os códigos previstos são:

| HTTP | `error.code` | Situação |
| --- | --- | --- |
| 400 | `invalid_request`, `invalid_json` | Campos, revisão ou JSON inválidos |
| 403 | `path_forbidden`, `host_forbidden` | Caminho ou host não permitido |
| 404 | `file_not_found`, `endpoint_not_found` | Arquivo ou endpoint ausente |
| 409 | `revision_conflict` | Arquivo alterado desde a última revisão |
| 411 | `length_required` | `Content-Length` ausente |
| 413 | `request_too_large` | Corpo maior que 4 MiB |
| 415 | `unsupported_media_type` | Corpo sem `application/json` |
| 422 | `invalid_html`, `invalid_encoding` | Página imprópria para edição |
| 500 | `read_failed`, `write_failed` | Falha de leitura ou gravação |

## Testes

Sem dependências externas e sem conexão de rede:

```bash
python3 -m unittest discover -s tests -p 'test_local_editor_server.py' -v
```

## Catálogo online

O GitHub Pages usa `catalogo.html` e o manifesto estático `catalogo.json` para
listar os índices e todas as músicas das pastas recentes. Depois de adicionar,
remover ou renomear uma dessas páginas, atualize e confira o manifesto:

```bash
python3 gerar_catalogo.py
python3 gerar_catalogo.py --check
```

O botão Home das páginas musicais abre as configurações no servidor local e o
catálogo nos demais endereços.
