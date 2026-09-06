# Importar cifra por imagem

No servidor local, abra uma cifra → **Editar cifra completa** → cole o link HTTPS
na linha **Link do Cifra Club** → **Importar por imagem**. O conteúdo preenche o
editor, mas só é gravado com **Salvar**. **Desfazer importação** restaura o texto
anterior à última importação. **Conferir print** mostra a imagem usada e permite
baixá-la. Funciona nos eventos que possuem o editor local e nos novos eventos.

## Instalação

Instale no mesmo ambiente Python usado para iniciar `local_editor_server.py`.
Na raiz do projeto, com um ambiente virtual ativo:

```sh
python -m pip install -r extrator_cifraclub/requirements.txt
python -m playwright install chromium
```

No Ubuntu/Debian instale também o executável e os idiomas:

```sh
sudo apt-get install tesseract-ocr tesseract-ocr-por tesseract-ocr-eng
```

Se o Chromium indicar bibliotecas do sistema ausentes, use
`python -m playwright install-deps chromium`.
No Windows, instale Tesseract, inclua sua pasta no PATH e instale os dados `por`
e `eng` (https://tesseract-ocr.github.io/tessdoc/Installation.html).
Reinicie o servidor após a instalação. Os scripts existentes usam `linux/venv`
ou `windows/venv`; se iniciar por eles, instale as dependências nesse ambiente.

## Como funciona e limites

O navegador localiza o corpo da cifra e prepara sua apresentação monoespaçada,
sem ler o texto do site. O PNG completo é a única fonte do OCR. As caixas de
caracteres do Tesseract são colocadas em uma grade global; faixas de 4 linhas
mantêm a origem vertical. Espaços internos, recuos e linhas vazias são
reconstruídos; espaços invisíveis ao final das linhas não são recuperáveis.
Para recuperar símbolos que o Tesseract confunde ou descarta (especialmente
traços de tablaturas), o extrator desenha um alfabeto próprio na mesma fonte e
compara os pixels de cada célula com esses glifos. Só usa correspondências
visuais seguras; não deduz acordes pela letra ou por regras musicais.
Não se consulta o texto HTML ou uma API para corrigir o OCR.

A captura inclui o corpo (letra, acordes, seções e tablaturas), excluindo título,
metadados externos, anúncios e diagramas de dedos. O conteúdo é capturado no tom
carregado pelo link, sem transposição pelo extrator. O serviço aceita uma
importação por vez e limita a região a 6000 × 30000 pixels CSS e 40 megapixels na imagem; não entrega um
recorte parcial quando exceder o limite. Página bloqueada, mudanças nos seletores
ou dependências ausentes produzem erro sem substituir o editor.

OCR pode confundir símbolos, acentos e acordes. Confira sempre o print antes de
salvar, principalmente quando houver avisos. Colisões de caracteres são marcadas
com `�`, sem deslocar o restante da linha. A imagem permanece apenas na memória
da resposta/modal e não é gravada automaticamente no repositório.

API local: `POST /__chord_editor__/import-cifraclub`, JSON `{"url":"https://www.cifraclub.com.br/artista/musica/"}`.
Sucesso retorna `ok`, `preText`, `image` (PNG data URL), `warnings` e `message`.
Erros seguem o formato `error.code` / `error.message` do servidor existente.

## Testes

`python -m unittest discover -s tests -q` executa a suíte sem rede.
Com Chromium e Tesseract instalados, use
`CIFRACLUB_BROWSER_TESTS=1 python -m unittest discover -s tests -v`
(no PowerShell, defina `$env:CIFRACLUB_BROWSER_TESTS="1"` antes).
Os testes de imagem verificam caracteres e colunas exatos, incluindo acordes,
acentos, tablaturas e linhas vazias. A extração real pode exigir revisão.
