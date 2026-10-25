# Spec: navegação e leitura de cifras

## Objetivo

Facilitar a apresentação e leitura das músicas no diretório `pergunte-aos-animais-musical`, permitindo navegar pelas estrofes com o teclado e ajustar o tamanho do texto da cifra.

## Escopo

As funcionalidades se aplicam às páginas individuais das músicas, não ao índice. A implementação deve preservar os controles e comportamentos existentes, incluindo edição de acordes, transposição, ocultação de cifras e rolagem automática.

## Requisitos funcionais

### Navegação por estrofes

1. Uma estrofe é cada bloco de conteúdo da cifra separado por linhas em branco. O bloco inclui todas as linhas nele presentes: acordes, letra, rótulos de seção e outros conteúdos.
2. Blocos de uma única linha que contenha colchetes, como `[Intro]` ou `[Refrão]`, são ignorados pela navegação. Blocos com mais de uma linha continuam navegáveis, mesmo que uma linha seja um rótulo entre colchetes.
3. A seta **↓** seleciona a primeira estrofe navegável quando ainda não há seleção; a seta **↑** seleciona a última. Com uma estrofe ativa, cada seta move a seleção uma estrofe navegável na direção correspondente.
4. A navegação para ao chegar à primeira ou última estrofe navegável; não há ciclo entre os extremos.
5. A estrofe selecionada recebe um destaque visual discreto, sem receber foco ou alterar o elemento atualmente focado.
6. Ao selecionar uma estrofe, a página rola suavemente para posicioná-la no centro vertical da área visível.
7. **Esc** encerra a navegação, remove o destaque e mantém a posição de rolagem atual.
8. Ao aceitar uma seta, a página não deve também executar a ação padrão de rolagem do navegador.
9. As teclas de navegação não devem ser capturadas enquanto o foco estiver em campos de entrada, modais ou controles interativos, incluindo acordes editáveis com `tabindex`.
10. Ao iniciar a navegação, a rolagem automática existente deve ser pausada e seu controle deve refletir esse estado. Ela não deve reiniciar automaticamente ao sair da navegação.

### Tamanho do texto

1. As páginas individuais das músicas devem oferecer controles **−** e **+**, uma indicação do tamanho atual e um controle para restaurar o padrão.
2. Os controles alteram somente o tamanho do conteúdo da cifra, sem redimensionar os controles da página.
3. O tamanho padrão é **100%**. O intervalo permitido é de **75% a 200%**.
4. A preferência deve persistir neste navegador entre visitas às páginas de cifras.
5. O zoom nativo do navegador, incluindo zoom por pinça e atalhos de teclado, deve permanecer habilitado e funcionar em conjunto com o ajuste de texto.

## Critérios de aceitação

- Em uma página de música, a primeira seta **↓** destaca a primeira estrofe navegável e a primeira seta **↑** destaca a última; blocos de uma linha com colchetes são pulados e blocos com outras linhas são considerados.
- Setas sucessivas percorrem as estrofes sem mover o foco; nos limites, a seleção permanece na estrofe extrema.
- A estrofe ativa fica centralizada verticalmente por rolagem suave e mantém o realce sem estilo de foco.
- Pressionar **Esc** remove o realce sem reposicionar a página.
- Campos, modais e controles interativos continuam recebendo suas teclas normalmente; em particular, a navegação não interfere no uso de acordes editáveis com `tabindex`.
- A rolagem automática é pausada ao iniciar a navegação, o controle mostra que está pausada e ela não reinicia ao sair.
- Os botões de tamanho ajustam apenas a cifra nos limites definidos, mostram o valor atual e permitem restaurar **100%**.
- A escolha do tamanho continua aplicada após recarregar a página no mesmo navegador.
- O zoom nativo do navegador continua funcionando junto com o ajuste próprio de tamanho.
- O índice e as demais páginas fora do diretório das músicas não exibem os novos controles nem recebem a navegação por estrofes.
