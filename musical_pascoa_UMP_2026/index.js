/**
 * Destaca linhas que contêm apenas cifras (acordes) com fundo laranja.
 * Roda ao carregar a página em todas as páginas que tenham <pre> com cifra.
 */
(function () {
  'use strict';

  // Acorde: nota (A-G, opcional #/b) + qualidade (m, maj, dim, etc.) + número + opcional /baixo
  var CHORD_REGEX = /[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M)?[0-9]*(?:\/[A-G][#b]?)?/g;

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Verifica se a linha contém apenas cifras (acordes) e espaços.
   * Linhas com letra ou marcadores de seção ([Intro], [Verso 1] etc.) retornam false.
   */
  function isChordLine(line) {
    var trimmed = line.trim();
    if (!trimmed) return false;

    var withoutChords = trimmed.replace(CHORD_REGEX, '');
    var withoutSpaces = withoutChords.replace(/\s/g, '');
    if (!withoutSpaces) return true;

    // Se sobrou algo com 2+ letras seguidas, é letra (não é linha só de cifra)
    if (/[a-zA-Zà-úÀ-Ú]{2,}/.test(withoutSpaces)) return false;

    return true;
  }

  function processPre(pre) {
    var text = pre.textContent || '';
    var lines = text.split('\n');
    var html = lines.map(function (line) {
      var escaped = escapeHtml(line);
      var chordLine = isChordLine(line);
      var spanClass = chordLine ? ' line-chord' : '';
      return '<span class="line' + spanClass + '">' + escaped + '</span>';
    }).join('\n');
    pre.innerHTML = html;
  }

  function init() {
    var pres = document.querySelectorAll('body > pre');
    for (var i = 0; i < pres.length; i++) {
      processPre(pres[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
