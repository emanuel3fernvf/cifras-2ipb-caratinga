/**
 * Destaca linhas que contêm apenas cifras (acordes) com fundo laranja.
 * Roda ao carregar a página em todas as páginas que tenham <pre> com cifra.
 */
(function () {
  'use strict';

  // Acorde: nota (A-G, opcional #/b) + qualidade (m, maj, dim, etc.) + número (+ opcional M, ex: G7M) + opcional /baixo
  var CHORD_REGEX = /[A-G][#b]?(?:m|min|maj|dim|aug|sus|add)?[0-9]*(?:M)?(?:\/([A-G][#b]?))?/g;

  // Notas cromáticas em sustenidos (usadas para transposição)
  var NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function normalizeNote(note) {
    // Converte bemóis para equivalentes em sustenido
    switch (note) {
      case 'Db': return 'C#';
      case 'Eb': return 'D#';
      case 'Gb': return 'F#';
      case 'Ab': return 'G#';
      case 'Bb': return 'A#';
      default: return note;
    }
  }

  function transposeNote(note, semitones) {
    var norm = normalizeNote(note);
    var idx = NOTES_SHARP.indexOf(norm);
    if (idx === -1) return note;
    var newIndex = (idx + semitones) % 12;
    if (newIndex < 0) newIndex += 12;
    return NOTES_SHARP[newIndex];
  }

  function transposeChordSymbol(chord, semitones) {
    if (!semitones) return chord;
    var match = chord.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
    if (!match) return chord;
    var root = match[1];
    var body = match[2] || '';
    var bass = match[3];

    var newRoot = transposeNote(root, semitones);
    var result = newRoot + body;

    if (bass) {
      var newBass = transposeNote(bass, semitones);
      result += '/' + newBass;
    }

    return result;
  }

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

  function processPre(pre, semitones) {
    if (typeof semitones !== 'number') semitones = 0;

    var originalText = pre.getAttribute('data-original-text');
    if (originalText == null) {
      originalText = pre.textContent || '';
      pre.setAttribute('data-original-text', originalText);
    }

    var lines = originalText.split('\n');
    var strophes = [];
    var current = [];

    function flushStrophe() {
      if (current.length) {
        strophes.push(current);
        current = [];
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim() === '') {
        // Linha vazia: apenas separa estrofes, não entra em nenhuma
        flushStrophe();
      } else {
        current.push(line);
      }
    }
    flushStrophe();

    var html = strophes.map(function (stropheLines) {
      var inner = stropheLines.map(function (line) {
        var chordOnly = isChordLine(line);
        var workingLine = line;

        if (semitones !== 0 && chordOnly) {
          workingLine = line.replace(CHORD_REGEX, function (ch) {
            return transposeChordSymbol(ch, semitones);
          });
        }

        var escaped = escapeHtml(workingLine);
        var spanClass = chordOnly ? ' line-chord' : '';
        return '<span class="line' + spanClass + '">' + escaped + '</span>';
      }).join('');
      return '<div class="strophe">' + inner + '</div>';
    }).join('\n');
    pre.innerHTML = html;
  }

  // --- Scroll automático ---
  var isScrolling = false;
  var speed = 5; // pixels por segundo (valor inicial)
  var minSpeed = 5;
  var maxSpeed = 200;
  var lastTs = null;
  var pendingScroll = 0; // acumula frações de pixel para velocidades baixas

  // --- Transposição de tom ---
  var currentTranspose = 0;
  var transposeDisplayEl = null;

  // --- Ocultar cifra ---
  var chordsHidden = false;
  var hideChordsBtnEl = null;

  function stepScroll(timestamp) {
    if (!isScrolling) {
      lastTs = null;
      return;
    }

    if (lastTs == null) {
      lastTs = timestamp;
    }

    var delta = (timestamp - lastTs) / 1000; // segundos
    lastTs = timestamp;

    // Acumula distância para evitar perder frações de pixel em velocidades baixas
    pendingScroll += speed * delta;
    var step = Math.floor(pendingScroll);
    if (step >= 1) {
      pendingScroll -= step;
      window.scrollBy(0, step);
    }

    // Para se chegar no final da página
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight) {
      isScrolling = false;
      lastTs = null;
      return;
    }

    window.requestAnimationFrame(stepScroll);
  }

  // --- Utilidades de transposição na URL ---
  function getTransposeFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var value = parseInt(params.get('tr'), 10);
      return isNaN(value) ? 0 : value;
    } catch (e) {
      return 0;
    }
  }

  function setTransposeInUrl(value) {
    try {
      var url = new URL(window.location.href);
      if (value === 0) {
        url.searchParams.delete('tr');
      } else {
        url.searchParams.set('tr', String(value));
      }
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      // ignore
    }
  }

  function formatTranspose(value) {
    if (value === 0) return '0';
    return (value > 0 ? '+' : '') + String(value);
  }

  function applyTransposeToAllPres() {
    var pres = document.querySelectorAll('body > pre');
    for (var i = 0; i < pres.length; i++) {
      processPre(pres[i], currentTranspose);
    }
    updateTransposeDisplay();
    setTransposeInUrl(currentTranspose);
  }

  function updateTransposeDisplay() {
    var els = document.querySelectorAll('.transpose-display');
    els.forEach(function (el) {
      el.textContent = formatTranspose(currentTranspose);
    });
  }

  // --- Utilidades de ocultar cifra na URL ---
  function getHideChordsFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('oc') === '1';
    } catch (e) {
      return false;
    }
  }

  function setHideChordsInUrl(hidden) {
    try {
      var url = new URL(window.location.href);
      if (hidden) {
        url.searchParams.set('oc', '1');
      } else {
        url.searchParams.delete('oc');
      }
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      // ignore
    }
  }

  function applyHideChords(hidden) {
    chordsHidden = hidden;
    document.body.classList.toggle('chords-hidden', hidden);
    setHideChordsInUrl(hidden);
    if (hideChordsBtnEl) {
      hideChordsBtnEl.classList.toggle('is-active', hidden);
      hideChordsBtnEl.title = hidden ? 'Mostrar cifra' : 'Ocultar cifra';
    }
  }

  function getLyricsText(lyricsOnly) {
    var pres = document.querySelectorAll('body > pre');
    var parts = [];

    for (var p = 0; p < pres.length; p++) {
      var strophes = pres[p].querySelectorAll('.strophe');
      var stropheTexts = [];

      for (var s = 0; s < strophes.length; s++) {
        var lines = strophes[s].querySelectorAll('.line');
        var lineTexts = [];

        for (var l = 0; l < lines.length; l++) {
          var lineEl = lines[l];
          if (lyricsOnly && lineEl.classList.contains('line-chord')) continue;
          lineTexts.push(lineEl.textContent);
        }

        if (lineTexts.length) {
          stropheTexts.push(lineTexts.join('\n'));
        }
      }

      if (stropheTexts.length) {
        parts.push(stropheTexts.join('\n\n'));
      }
    }

    return parts.join('\n\n');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject();
      } catch (e) {
        reject(e);
      }
      document.body.removeChild(ta);
    });
  }

  function createSvgIcon(pathD) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  var ICON_COPY = 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';
  var ICON_VISIBILITY_OFF = 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75l-1.73-1.73c-.55.95-1.26 1.78-2.09 2.44L12 7zm-4.27 3.77L3.41 6.41 2 7.82l3.53 3.53C5.21 12.47 5 13.69 5 15c0 2.76 2.24 5 5 5 .88 0 1.71-.23 2.43-.63l-2.07-2.07c-.54.17-1.11.27-1.7.27-2.21 0-4-1.79-4-4 0-.59.1-1.16.27-1.7zM12 4.5c3.73 0 6.83 2.36 8.01 5.66l1.73-1.73C20.55 4.84 16.48 2 12 2 10.47 2 9.03 2.38 7.79 3.03L9.4 4.64C10.15 4.22 11.04 4 12 4.5zM2 4.27l2.75 2.75C3.08 8.26 2 10.9 2 13.5c0 5.52 4.48 10 10 10 2.45 0 4.69-.88 6.43-2.34l2.28 2.28 1.41-1.41L3.41 2.86 2 4.27z';

  function createToolbarExtraRow(parent) {
    if (!document.querySelector('body > pre')) return;
    if (parent.querySelector('.toolbar-extra-row')) return;

    var row = document.createElement('div');
    row.className = 'toolbar-extra-row';

    var dropdown = document.createElement('div');
    dropdown.className = 'copy-dropdown';

    var btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.className = 'video-sticky-toggle icon-btn';
    btnCopy.title = 'copiar';
    btnCopy.appendChild(createSvgIcon(ICON_COPY));

    var menu = document.createElement('div');
    menu.className = 'copy-dropdown-menu';
    menu.hidden = true;

    function addMenuOption(label, lyricsOnly) {
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'copy-dropdown-option';
      opt.textContent = label;
      opt.addEventListener('click', function () {
        menu.hidden = true;
        copyToClipboard(getLyricsText(lyricsOnly)).catch(function () {});
      });
      menu.appendChild(opt);
    }

    addMenuOption('Copiar tudo', false);
    addMenuOption('Copiar somente letra', true);

    btnCopy.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });

    document.addEventListener('click', function () {
      menu.hidden = true;
    });

    dropdown.appendChild(btnCopy);
    dropdown.appendChild(menu);

    hideChordsBtnEl = document.createElement('button');
    hideChordsBtnEl.type = 'button';
    hideChordsBtnEl.className = 'video-sticky-toggle icon-btn';
    hideChordsBtnEl.title = chordsHidden ? 'Mostrar cifra' : 'Ocultar cifra';
    hideChordsBtnEl.appendChild(createSvgIcon(ICON_VISIBILITY_OFF));
    if (chordsHidden) hideChordsBtnEl.classList.add('is-active');

    hideChordsBtnEl.addEventListener('click', function () {
      applyHideChords(!chordsHidden);
    });

    row.appendChild(dropdown);
    row.appendChild(hideChordsBtnEl);
    parent.appendChild(row);
  }

  function updateSpeedDisplay(span) {
    span.textContent = speed + ' px/s';
  }

  function createAutoScrollPanel() {
    if (document.querySelector('.auto-scroll-panel')) return;

    var panel = document.createElement('div');
    panel.className = 'auto-scroll-panel';

    var label = document.createElement('span');
    label.textContent = 'Rolagem:';

    var btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.textContent = 'Iniciar';

    var btnSlower = document.createElement('button');
    btnSlower.type = 'button';
    btnSlower.textContent = '-';

    var speedSpan = document.createElement('span');
    speedSpan.className = 'auto-scroll-speed';

    var btnFaster = document.createElement('button');
    btnFaster.type = 'button';
    btnFaster.textContent = '+';

    updateSpeedDisplay(speedSpan);

    btnToggle.addEventListener('click', function () {
      if (!isScrolling) {
        isScrolling = true;
        lastTs = null;
        btnToggle.textContent = 'Parar';
        window.requestAnimationFrame(stepScroll);
      } else {
        isScrolling = false;
        lastTs = null;
        btnToggle.textContent = 'Iniciar';
      }
    });

    btnSlower.addEventListener('click', function () {
      speed = Math.max(minSpeed, speed - 5);
      updateSpeedDisplay(speedSpan);
    });

    btnFaster.addEventListener('click', function () {
      speed = Math.min(maxSpeed, speed + 5);
      updateSpeedDisplay(speedSpan);
    });

    panel.appendChild(label);
    panel.appendChild(btnToggle);
    panel.appendChild(btnSlower);
    panel.appendChild(speedSpan);
    panel.appendChild(btnFaster);

    document.body.appendChild(panel);
  }

  function createVideoStickyToggle() {
    if (document.querySelector('.tone-toolbar')) return;

    var iframe = document.querySelector('iframe.sticky-top');
    if (!iframe) return;

    // Garante que começa não fixo
    iframe.classList.remove('sticky-fixed');

    var toolbar = document.createElement('div');
    toolbar.className = 'tone-toolbar';
    toolbar.style.textAlign = 'left';
    toolbar.style.margin = '4px 0 8px 0';

    var row1 = document.createElement('div');
    row1.className = 'tone-toolbar-row';

    var btnSticky = document.createElement('button');
    btnSticky.type = 'button';
    btnSticky.className = 'video-sticky-toggle';
    btnSticky.textContent = 'Fixar vídeo';

    var toneLabel = document.createElement('span');
    toneLabel.style.marginLeft = '0';
    toneLabel.style.marginRight = '4px';
    toneLabel.textContent = 'Tom: ';

    var toneValue = document.createElement('span');
    toneValue.style.marginRight = '8px';
    toneValue.className = 'transpose-display';
    toneValue.textContent = formatTranspose(currentTranspose);

    var btnToneDown = document.createElement('button');
    btnToneDown.type = 'button';
    btnToneDown.className = 'video-sticky-toggle';
    btnToneDown.textContent = '−';

    var btnToneUp = document.createElement('button');
    btnToneUp.type = 'button';
    btnToneUp.className = 'video-sticky-toggle';
    btnToneUp.textContent = '+';

    var btnToneReset = document.createElement('button');
    btnToneReset.type = 'button';
    btnToneReset.className = 'video-sticky-toggle';
    btnToneReset.textContent = 'Reset';

    var fixed = false;
    btnSticky.addEventListener('click', function () {
      fixed = !fixed;
      if (fixed) {
        iframe.classList.add('sticky-fixed');
        btnSticky.textContent = 'Soltar vídeo';
      } else {
        iframe.classList.remove('sticky-fixed');
        btnSticky.textContent = 'Fixar vídeo';
      }
    });

    btnToneDown.addEventListener('click', function () {
      currentTranspose -= 1;
      applyTransposeToAllPres();
    });

    btnToneUp.addEventListener('click', function () {
      currentTranspose += 1;
      applyTransposeToAllPres();
    });

    btnToneReset.addEventListener('click', function () {
      currentTranspose = 0;
      applyTransposeToAllPres();
    });

    row1.appendChild(toneLabel);
    row1.appendChild(toneValue);
    row1.appendChild(btnToneDown);
    row1.appendChild(btnToneUp);
    row1.appendChild(btnToneReset);
    row1.appendChild(btnSticky);

    toolbar.appendChild(row1);
    createToolbarExtraRow(toolbar);

    // Insere logo após o iframe
    if (iframe.parentNode) {
      iframe.parentNode.insertBefore(toolbar, iframe.nextSibling);
    } else {
      document.body.insertBefore(toolbar, document.body.firstChild);
    }
  }

  // --- Exportar para Holyrics (índice) ---

  /**
   * HOLYRICS_HYPHEN_WORDS — allowlist de hífens ortográficos (export Holyrics).
   *
   * IA / agentes: ao criar ou editar cifras nesta pasta (HTMLs com <pre>),
   * varrer as letras por palavras com hífen único (-) que sejam gramaticalmente
   * corretas em português (clíticos, compostos, etc.) e ADICIONAR aqui em
   * minúsculas se ainda não estiverem. Não incluir melismas (Rei--no, tu----a).
   * Não remover entradas sem motivo.
   */
  var HOLYRICS_HYPHEN_WORDS = {
    'dá-me': true,
    'todo-poderoso': true
  };

  function cleanLyricHyphensForHolyrics(line) {
    // 1) Melisma claro: 2+ hífens consecutivos
    var cleaned = String(line || '').replace(/-{2,}/g, '');

    // 2) Tokens com hífen único: preserva só se estiver no dicionário
    cleaned = cleaned.replace(/\S+/g, function (token) {
      if (token.indexOf('-') === -1) return token;
      // Se ainda houver 2+ hífens (não deveria), remove
      if (/-{2,}/.test(token)) {
        token = token.replace(/-{2,}/g, '');
      }
      if (token.indexOf('-') === -1) return token;

      // Compara sem pontuação ao redor (mantém pontuação no resultado)
      var match = token.match(/^([^a-zA-Zà-úÀ-Ú]*)([a-zA-Zà-úÀ-Ú]+(?:-[a-zA-Zà-úÀ-Ú]+)+)([^a-zA-Zà-úÀ-Ú]*)$/);
      if (!match) {
        // Hífen residual atípico: remove hífens
        return token.replace(/-/g, '');
      }
      var prefix = match[1];
      var core = match[2];
      var suffix = match[3];
      var key = core.toLowerCase();
      if (HOLYRICS_HYPHEN_WORDS[key]) {
        return prefix + core + suffix;
      }
      return prefix + core.replace(/-/g, '') + suffix;
    });

    // 3) Espaços múltiplos
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    return cleaned;
  }

  function getSongLinksFromIndex() {
    var content = document.getElementById('content');
    if (!content) return [];
    var anchors = content.querySelectorAll('a[href]');
    var seen = {};
    var urls = [];
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href') || '';
      if (!/\.html/i.test(href)) continue;
      var path = href.split('?')[0];
      if (seen[path]) continue;
      seen[path] = true;
      urls.push(path);
    }
    return urls;
  }

  function processPreTextForHolyrics(rawText, withChords) {
    var lines = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var start = -1;
    for (var i = 0; i < lines.length; i++) {
      if (isChordLine(lines[i])) {
        start = i;
        break;
      }
    }
    if (start === -1) return '';

    var out = [];
    for (var j = start; j < lines.length; j++) {
      var line = lines[j];
      if (/[\[\]]/.test(line)) continue;
      if (isChordLine(line)) {
        if (withChords) {
          out.push('// ' + line.trimEnd());
        }
        continue;
      }
      out.push(cleanLyricHyphensForHolyrics(line));
    }

    // Compacta linhas vazias no início/fim e grupos de vazias em uma só
    while (out.length && out[0].trim() === '') out.shift();
    while (out.length && out[out.length - 1].trim() === '') out.pop();

    var compacted = [];
    var prevEmpty = false;
    for (var k = 0; k < out.length; k++) {
      var empty = out[k].trim() === '';
      if (empty) {
        if (!prevEmpty) compacted.push('');
        prevEmpty = true;
      } else {
        compacted.push(out[k]);
        prevEmpty = false;
      }
    }
    return compacted.join('\n');
  }

  function textToParagraphs(fullText) {
    if (!fullText) return [];
    return fullText.split(/\n\s*\n/).map(function (p) {
      return p.replace(/^\n+|\n+$/g, '').trimEnd();
    }).filter(function (p) {
      return p.trim() !== '';
    });
  }

  function buildHolyricsSong(id, title, artist, fullText) {
    var paragraphs = textToParagraphs(fullText);
    return {
      id: id,
      title: title,
      artist: artist,
      author: '',
      note: '',
      copyright: '',
      language: '',
      key: '',
      bpm: 0.0,
      time_sig: '',
      midi: null,
      order: '',
      arrangements: [],
      lyrics: {
        full_text: paragraphs.join('\n\n'),
        full_text_with_comment: null,
        paragraphs: paragraphs.map(function (p, idx) {
          return {
            number: idx + 1,
            description: '',
            text: p,
            text_with_comment: null,
            translations: null
          };
        })
      },
      streaming: {
        audio: { spotify: '', youtube: '', deezer: '' },
        backing_track: { spotify: '', youtube: '', deezer: '' }
      },
      extras: { extra: '' }
    };
  }

  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function parseSongHtml(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var titleEl = doc.querySelector('.holyrics-title');
    var artistEl = doc.querySelector('.holyrics-artist');
    var pre = doc.querySelector('body > pre');
    return {
      title: titleEl ? (titleEl.textContent || '').trim() : '',
      artist: artistEl ? (artistEl.textContent || '').trim() : '',
      preText: pre ? (pre.textContent || '') : ''
    };
  }

  function exportHolyrics(mode) {
    var withChords = mode === 'cifra';
    var urls = getSongLinksFromIndex();
    if (!urls.length) {
      window.alert('Nenhuma cifra encontrada no índice.');
      return Promise.resolve();
    }

    if (window.location.protocol === 'file:') {
      window.alert('Abra o índice via servidor HTTP local (ex.: python -m http.server) para exportar.');
      return Promise.resolve();
    }

    var baseId = Date.now();
    return Promise.all(urls.map(function (url) {
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error('Falha ao carregar ' + url);
        return res.text();
      });
    })).then(function (htmls) {
      var songs = htmls.map(function (html, idx) {
        var parsed = parseSongHtml(html);
        var fullText = processPreTextForHolyrics(parsed.preText, withChords);
        return buildHolyricsSong(
          baseId + idx,
          parsed.title || ('Música ' + (idx + 1)),
          parsed.artist || '',
          fullText
        );
      });
      var suffix = withChords ? 'cifra' : 'letra';
      downloadJson('2026-07-12_holyrics-' + suffix + '.json', songs);
    }).catch(function (err) {
      console.error(err);
      window.alert('Erro ao exportar: ' + (err && err.message ? err.message : String(err)));
    });
  }

  function initHolyricsExport() {
    var btn = document.getElementById('holyrics-export-btn');
    var menu = document.getElementById('holyrics-export-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });

    menu.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    var options = menu.querySelectorAll('.holyrics-export-option');
    for (var i = 0; i < options.length; i++) {
      options[i].addEventListener('click', function () {
        var mode = this.getAttribute('data-mode') || 'letra';
        menu.hidden = true;
        exportHolyrics(mode);
      });
    }

    document.addEventListener('click', function () {
      menu.hidden = true;
    });
  }

  function init() {
    if (document.getElementById('holyrics-export')) {
      initHolyricsExport();
      return;
    }

    // Carrega transposição e ocultar cifra da URL
    currentTranspose = getTransposeFromUrl();
    chordsHidden = getHideChordsFromUrl();
    if (chordsHidden) {
      document.body.classList.add('chords-hidden');
    }

    var pres = document.querySelectorAll('body > pre');
    for (var i = 0; i < pres.length; i++) {
      processPre(pres[i], currentTranspose);
    }
    createAutoScrollPanel();
    if (document.querySelector('iframe.sticky-top')) {
      createVideoStickyToggle();
    } else {
      createTopToneControls();
    }

    // Garante que o display de tom e a URL estejam sincronizados
    applyTransposeToAllPres();
    createWarmPadPlayer();
  }

  // --- Warm Pad Player ---
  var PAD_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
  var PAD_BASE_PATH = '../Warm Pads/';
  var padAudio = null;
  var padPlayingNote = null;
  var padScale = 'C';
  var padCustomNotes = [];
  var padPanelEl = null;
  var padGridEl = null;
  var padCustomEl = null;
  var padScaleSelectEl = null;

  function getMajorScale(root) {
    var idx = PAD_NOTES.indexOf(root);
    if (idx === -1) return PAD_NOTES.slice();
    return MAJOR_SCALE_INTERVALS.map(function (i) {
      return PAD_NOTES[(idx + i) % 12];
    });
  }

  function getPadFilePath(note) {
    var num = PAD_NOTES.indexOf(note) + 1;
    var padded = num < 10 ? '0' + num : String(num);
    // "#" vira fragmento na URL — precisa ser %23 (ex.: C%23.mp3)
    var filename = padded + ' - WARM PAD - ' + note.replace(/#/g, '%23') + '.mp3';
    var relativePath = PAD_BASE_PATH + filename;
    try {
      return new URL(relativePath, window.location.href).href;
    } catch (e) {
      return encodeURI(relativePath);
    }
  }

  function getVisiblePadNotes() {
    if (padScale === 'custom') {
      return padCustomNotes.slice();
    }
    return getMajorScale(padScale);
  }

  function stopPadAudio() {
    if (padAudio) {
      padAudio.pause();
      padAudio.currentTime = 0;
      padAudio = null;
    }
    padPlayingNote = null;
    if (padGridEl) {
      var active = padGridEl.querySelectorAll('.warm-pad-btn.active');
      for (var i = 0; i < active.length; i++) {
        active[i].classList.remove('active');
      }
    }
  }

  function playPadNote(note) {
    if (padPlayingNote === note) {
      stopPadAudio();
      return;
    }
    stopPadAudio();
    padAudio = new Audio(getPadFilePath(note));
    padAudio.loop = true;
    padPlayingNote = note;
    padAudio.play().catch(function (err) {
      console.error('Warm Pad:', note, getPadFilePath(note), err);
    });
    if (padGridEl) {
      var btn = padGridEl.querySelector('[data-note="' + note + '"]');
      if (btn) btn.classList.add('active');
    }
  }

  function getScaleFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var escala = params.get('escala');
      if (!escala) return { scale: 'C', customNotes: [] };
      if (escala === 'custom' || escala === 'personalizado') {
        var notas = params.get('notas') || '';
        var notes = notas.split(',').map(function (n) { return n.trim(); }).filter(function (n) {
          return PAD_NOTES.indexOf(n) !== -1;
        });
        return { scale: 'custom', customNotes: notes };
      }
      if (PAD_NOTES.indexOf(escala) !== -1) {
        return { scale: escala, customNotes: [] };
      }
      return { scale: 'C', customNotes: [] };
    } catch (e) {
      return { scale: 'C', customNotes: [] };
    }
  }

  function setScaleInUrl(scale, customNotes) {
    try {
      var url = new URL(window.location.href);
      if (scale === 'custom') {
        url.searchParams.set('escala', 'custom');
        if (customNotes.length) {
          url.searchParams.set('notas', customNotes.join(','));
        } else {
          url.searchParams.delete('notas');
        }
      } else if (scale === 'C') {
        url.searchParams.delete('escala');
        url.searchParams.delete('notas');
      } else {
        url.searchParams.set('escala', scale);
        url.searchParams.delete('notas');
      }
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      // ignore
    }
  }

  function renderPadGrid() {
    if (!padGridEl) return;
    padGridEl.innerHTML = '';
    var notes = getVisiblePadNotes();
    notes.forEach(function (note) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'warm-pad-btn';
      btn.setAttribute('data-note', note);
      if (note === padPlayingNote) btn.classList.add('active');

      var label = document.createElement('span');
      label.className = 'pad-label';
      label.textContent = note;
      btn.appendChild(label);

      btn.addEventListener('click', function () {
        playPadNote(note);
      });

      padGridEl.appendChild(btn);
    });
  }

  function renderCustomCheckboxes() {
    if (!padCustomEl) return;
    padCustomEl.innerHTML = '';
    PAD_NOTES.forEach(function (note) {
      var lbl = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = note;
      cb.checked = padCustomNotes.indexOf(note) !== -1;
      cb.addEventListener('change', function () {
        if (cb.checked) {
          if (padCustomNotes.indexOf(note) === -1) padCustomNotes.push(note);
        } else {
          padCustomNotes = padCustomNotes.filter(function (n) { return n !== note; });
        }
        padCustomNotes.sort(function (a, b) {
          return PAD_NOTES.indexOf(a) - PAD_NOTES.indexOf(b);
        });
        setScaleInUrl('custom', padCustomNotes);
        renderPadGrid();
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(note));
      padCustomEl.appendChild(lbl);
    });
  }

  function updatePadScaleUI() {
    if (padScaleSelectEl) padScaleSelectEl.value = padScale;
    if (padCustomEl) {
      padCustomEl.classList.toggle('visible', padScale === 'custom');
    }
    var visible = getVisiblePadNotes();
    if (padPlayingNote && visible.indexOf(padPlayingNote) === -1) {
      stopPadAudio();
    }
    renderPadGrid();
  }

  function createWarmPadPlayer() {
    if (document.querySelector('.warm-pad-toggle')) return;

    var urlScale = getScaleFromUrl();
    padScale = urlScale.scale;
    padCustomNotes = urlScale.customNotes;

    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'warm-pad-toggle';
    toggleBtn.textContent = 'Mostrar Pad';

    padPanelEl = document.createElement('div');
    padPanelEl.className = 'warm-pad-panel';

    var controls = document.createElement('div');
    controls.className = 'warm-pad-controls';

    var scaleLabel = document.createElement('label');
    scaleLabel.textContent = 'Escala:';
    scaleLabel.setAttribute('for', 'warm-pad-scale');

    padScaleSelectEl = document.createElement('select');
    padScaleSelectEl.id = 'warm-pad-scale';
    PAD_NOTES.forEach(function (note) {
      var opt = document.createElement('option');
      opt.value = note;
      opt.textContent = note + ' maior';
      padScaleSelectEl.appendChild(opt);
    });
    var customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Personalizado';
    padScaleSelectEl.appendChild(customOpt);
    padScaleSelectEl.value = padScale;

    padScaleSelectEl.addEventListener('change', function () {
      padScale = padScaleSelectEl.value;
      if (padScale !== 'custom') {
        padCustomNotes = [];
      }
      setScaleInUrl(padScale, padCustomNotes);
      updatePadScaleUI();
    });

    controls.appendChild(scaleLabel);
    controls.appendChild(padScaleSelectEl);

    padCustomEl = document.createElement('div');
    padCustomEl.className = 'warm-pad-custom';

    padGridEl = document.createElement('div');
    padGridEl.className = 'warm-pad-grid';

    padPanelEl.appendChild(controls);
    padPanelEl.appendChild(padCustomEl);
    padPanelEl.appendChild(padGridEl);

    toggleBtn.addEventListener('click', function () {
      var visible = padPanelEl.classList.toggle('visible');
      toggleBtn.textContent = visible ? 'Ocultar Pad' : 'Mostrar Pad';
    });

    renderCustomCheckboxes();
    updatePadScaleUI();

    document.body.appendChild(toggleBtn);
    document.body.appendChild(padPanelEl);
  }

  // Cria controles de tom no topo quando não houver iframe (ou sempre exibe controles no topo)
  function createTopToneControls() {
    // não duplicar
    if (document.querySelector('.top-tone-controls')) return;

    var container = document.createElement('div');
    container.className = 'top-tone-controls tone-toolbar';
    container.style.position = 'sticky';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.zIndex = '250';
    container.style.padding = '8px 10px';
    container.style.marginBottom = '8px';
    container.style.background = '#fff';
    container.style.borderBottom = '1px solid #ddd';

    var row1 = document.createElement('div');
    row1.className = 'tone-toolbar-row';

    var toneLabel = document.createElement('span');
    toneLabel.textContent = 'Tom:';

    var toneValue = document.createElement('span');
    toneValue.className = 'transpose-display';
    toneValue.textContent = formatTranspose(currentTranspose);

    var btnToneDown = document.createElement('button');
    btnToneDown.type = 'button';
    btnToneDown.textContent = '−';
    btnToneDown.className = 'video-sticky-toggle';
    btnToneDown.addEventListener('click', function () {
      currentTranspose -= 1;
      applyTransposeToAllPres();
    });

    var btnToneUp = document.createElement('button');
    btnToneUp.type = 'button';
    btnToneUp.textContent = '+';
    btnToneUp.className = 'video-sticky-toggle';
    btnToneUp.addEventListener('click', function () {
      currentTranspose += 1;
      applyTransposeToAllPres();
    });

    var btnToneReset = document.createElement('button');
    btnToneReset.type = 'button';
    btnToneReset.textContent = 'Reset';
    btnToneReset.className = 'video-sticky-toggle';
    btnToneReset.addEventListener('click', function () {
      currentTranspose = 0;
      applyTransposeToAllPres();
    });

    row1.appendChild(toneLabel);
    row1.appendChild(toneValue);
    row1.appendChild(btnToneDown);
    row1.appendChild(btnToneUp);
    row1.appendChild(btnToneReset);

    container.appendChild(row1);
    createToolbarExtraRow(container);

    document.body.insertBefore(container, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
