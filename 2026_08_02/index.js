/**
 * Destaca linhas que contêm apenas cifras (acordes) com fundo laranja.
 * Roda ao carregar a página em todas as páginas que tenham <pre> com cifra.
 */
(function () {
  'use strict';

  // Acorde: nota (A-G, opcional #/b) + qualidade (m, maj, dim, etc.) + número (+ opcional M, ex: G7M) + opcional /baixo
  var CHORD_REGEX = /[A-G][#b]?(?:m|min|maj|dim|aug|sus|add|°)?[0-9]*(?:M)?(?:\/([A-G][#b]?))?/g;

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

  function getChordMatches(line) {
    var chordRegex = new RegExp(CHORD_REGEX.source, CHORD_REGEX.flags);
    var matches = [];
    var match;

    while ((match = chordRegex.exec(line)) !== null) {
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return matches;
  }

  function renderChordLineContents(line) {
    if (!localEditor || !localEditor.enabled) return escapeHtml(line);

    var matches = getChordMatches(line);
    var pieces = [];
    var cursor = 0;

    for (var i = 0; i < matches.length; i++) {
      var chord = matches[i];
      pieces.push(escapeHtml(line.slice(cursor, chord.start)));
      pieces.push(
        '<span class="editable-chord" tabindex="0" role="button" aria-selected="false"' +
        ' aria-label="Acorde" data-chord-start="' + chord.start +
        '" data-chord-end="' + chord.end + '" draggable="' +
        (currentTranspose === 0 && !localEditor.busy ? 'true' : 'false') + '">' +
        escapeHtml(chord.text) + '</span>'
      );
      cursor = chord.end;
    }

    pieces.push(escapeHtml(line.slice(cursor)));
    return pieces.join('');
  }

  function renderLineEditButton() {
    if (!localEditor || !localEditor.enabled) return '';
    return '<button type="button" class="line-edit-button" aria-label="Editar linha"' +
      ' title="Editar linha">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25zm15.71-10.42a1 1 0 0 0 0-1.42l-1.12-1.12a1 1 0 0 0-1.42 0l-.88.88 2.75 2.75.67-.67z"/>' +
      '</svg></button>';
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
        current.push({ text: line, index: i });
      }
    }
    flushStrophe();

    var html = strophes.map(function (stropheLines) {
      var inner = stropheLines.map(function (lineData) {
        var line = lineData.text;
        var chordOnly = isChordLine(line);
        var workingLine = line;

        if (semitones !== 0 && chordOnly) {
          workingLine = line.replace(CHORD_REGEX, function (ch) {
            return transposeChordSymbol(ch, semitones);
          });
        }

        var escaped = chordOnly ? renderChordLineContents(workingLine) : escapeHtml(workingLine);
        var spanClass = chordOnly ? ' line-chord' : '';
        return '<span class="line' + spanClass + '" data-line-index="' +
          lineData.index + '">' + escaped + renderLineEditButton() + '</span>';
      }).join('');
      return '<div class="strophe">' + inner + '</div>';
    }).join('\n');
    if (localEditor && localEditor.pre === pre) {
      localEditor.selectedChord = null;
      hideEditorContextMenu();
    }
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

  // --- Editor local de cifras ---
  var localEditor = {
    enabled: false,
    busy: false,
    pre: null,
    preText: '',
    revision: null,
    path: '',
    selectedChord: null,
    editButton: null,
    rewriteButton: null,
    palette: null,
    paletteGrid: null,
    contextMenu: null,
    modal: null,
    drag: null,
    paletteDrag: null,
    paletteEmpty: null,
    suppressClick: false,
    interactionsInitialized: false
  };

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
    refreshLocalEditorUi();
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
  var ICON_EDIT = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
  var ICON_REWRITE = 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.09 0-7.19 3.72-6.39 7.69L3.55 9.63C3.2 14.67 7.19 19 12 19c3.38 0 6.31-1.87 7.84-4.63l-1.76-1.02C16.91 15.52 14.62 17 12 17c-3.72 0-6.66-3.45-5.86-7.1l2.58 2.58L10.14 11 5 5.86.86 10l1.42 1.42 2.03-2.04C3.45 14.48 7.34 19 12 19c4.42 0 8-3.58 8-8 0-2.21-.9-4.21-2.35-5.65z';

  function createLocalEditorToolbarButtons(row) {
    if (!localEditor.enabled || !row || localEditor.editButton) return;

    var editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'video-sticky-toggle icon-btn local-editor-toolbar-btn';
    editButton.title = 'Editar';
    editButton.setAttribute('aria-label', 'Editar cifra completa');
    editButton.appendChild(createSvgIcon(ICON_EDIT));
    editButton.addEventListener('click', function () {
      if (currentTranspose !== 0 || localEditor.busy) return;
      openFullEditorModal();
    });

    var rewriteButton = document.createElement('button');
    rewriteButton.type = 'button';
    rewriteButton.className = 'video-sticky-toggle icon-btn local-editor-toolbar-btn';
    rewriteButton.title = 'Reescrever';
    rewriteButton.setAttribute('aria-label', 'Reescrever cifra no tom exibido');
    rewriteButton.appendChild(createSvgIcon(ICON_REWRITE));
    rewriteButton.addEventListener('click', function () {
      if (currentTranspose === 0 || localEditor.busy) return;
      openRewriteModal();
    });

    localEditor.editButton = editButton;
    localEditor.rewriteButton = rewriteButton;
    row.appendChild(editButton);
    row.appendChild(rewriteButton);
    refreshLocalEditorUi();
  }

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
    createLocalEditorToolbarButtons(row);
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
      updatePalettePosition();
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

  function getLocalDocumentPath() {
    var path = window.location.pathname || '';
    try {
      path = decodeURIComponent(path);
    } catch (e) {
      // Mantém o pathname codificado se houver sequência inválida.
    }
    return path.replace(/^\/+/, '');
  }

  function fetchEditorJson(url, options) {
    var requestOptions = options || {};
    requestOptions.cache = 'no-store';
    requestOptions.credentials = 'same-origin';

    return fetch(url, requestOptions).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok) {
          var serverError = payload.error;
          var message = payload.message;
          if (serverError && typeof serverError === 'object') {
            message = serverError.message || message;
          } else if (typeof serverError === 'string') {
            message = serverError;
          }
          var error = new Error(message || ('Erro HTTP ' + response.status));
          error.status = response.status;
          error.payload = payload;
          throw error;
        }
        return payload;
      });
    });
  }

  function showLocalEditorGuidance() {
    if (document.querySelector('.local-editor-guidance')) return;
    var guidance = document.createElement('div');
    guidance.className = 'local-editor-guidance';
    guidance.textContent = 'Para editar esta cifra, execute python3 local_editor_server.py e abra o endereço local informado.';
    guidance.setAttribute('role', 'status');
    var pre = document.querySelector('body > pre');
    document.body.insertBefore(guidance, pre || document.body.firstChild);
  }

  function showLocalEditorNotification(message, type) {
    var container = document.querySelector('.editor-notification-stack');
    if (!container) {
      container = document.createElement('div');
      container.className = 'editor-notification-stack';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    var notification = document.createElement('div');
    notification.className = 'editor-notification' + (type ? ' is-' + type : '');
    notification.textContent = message;
    container.appendChild(notification);

    window.setTimeout(function () {
      if (notification.parentNode) notification.parentNode.removeChild(notification);
      if (!container.childNodes.length && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, type === 'error' ? 7000 : 3500);
  }

  function setLocalEditorBusy(busy) {
    localEditor.busy = !!busy;
    document.body.classList.toggle('local-editor-busy', localEditor.busy);
    refreshLocalEditorUi();
  }

  function getLocalEditorLines() {
    return localEditor.preText.split('\n');
  }

  function buildPreTextWithLine(lineIndex, nextLine) {
    var lines = getLocalEditorLines();
    if (lineIndex < 0 || lineIndex >= lines.length) return null;
    lines[lineIndex] = nextLine;
    return lines.join('\n');
  }

  function commitSavedPreText(preText, revision, options) {
    var saveOptions = options || {};
    localEditor.preText = preText;
    localEditor.revision = revision;
    localEditor.pre.setAttribute('data-original-text', preText);

    if (saveOptions.resetTranspose) currentTranspose = 0;

    processPre(localEditor.pre, currentTranspose);
    updateTransposeDisplay();
    setTransposeInUrl(currentTranspose);
    refreshLocalEditorUi();
  }

  function restoreChordSelection(selection) {
    if (!selection || !localEditor.pre) return;
    var lineElement = localEditor.pre.querySelector(
      '.line-chord[data-line-index="' + selection.lineIndex + '"]'
    );
    if (!lineElement) return;
    var chordElements = lineElement.querySelectorAll('.editable-chord');
    for (var i = 0; i < chordElements.length; i++) {
      if (parseInt(chordElements[i].getAttribute('data-chord-start'), 10) !== selection.start) continue;
      if ((chordElements[i].textContent || '') !== selection.text) continue;
      if (!selectEditableChord(chordElements[i])) return;
      try {
        chordElements[i].focus({ preventScroll: true });
      } catch (error) {
        chordElements[i].focus();
      }
      return;
    }
  }

  function saveLocalPreText(nextText, options) {
    var saveOptions = options || {};
    if (!localEditor.enabled || localEditor.busy) {
      return Promise.reject(new Error('O editor está ocupado.'));
    }
    if (nextText === localEditor.preText) return Promise.resolve(false);

    var savingLine = saveOptions.lineElement || null;
    if (savingLine) savingLine.classList.add('is-saving');
    setLocalEditorBusy(true);

    return fetchEditorJson('/__chord_editor__/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: localEditor.path,
        preText: nextText,
        expectedRevision: localEditor.revision
      })
    }).then(function (result) {
      if (result.revision == null) throw new Error('O servidor não retornou a nova revisão.');
      commitSavedPreText(nextText, result.revision, saveOptions);
      setLocalEditorBusy(false);
      restoreChordSelection(saveOptions.restoreSelection);
      if (saveOptions.successMessage) {
        showLocalEditorNotification(saveOptions.successMessage, 'success');
      }
      return true;
    }).catch(function (error) {
      if (savingLine) savingLine.classList.remove('is-saving');
      setLocalEditorBusy(false);
      if (error.status === 409) {
        showLocalEditorNotification(
          'O arquivo foi alterado fora do editor. Recarregue a página antes de tentar novamente.',
          'error'
        );
      } else {
        showLocalEditorNotification(error.message || 'Não foi possível salvar a cifra.', 'error');
      }
      throw error;
    });
  }

  function createEditorModal(title, primaryLabel) {
    if (localEditor.modal) localEditor.modal.close(true);

    var overlay = document.createElement('div');
    overlay.className = 'editor-modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'editor-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    var heading = document.createElement('h2');
    heading.className = 'editor-modal-title';
    heading.textContent = title;

    var header = document.createElement('div');
    header.className = 'editor-modal-header';
    header.appendChild(heading);

    var body = document.createElement('div');
    body.className = 'editor-modal-body';

    var actions = document.createElement('div');
    actions.className = 'editor-modal-actions';

    var cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'editor-modal-button';
    cancelButton.textContent = 'Cancelar';

    var primaryButton = document.createElement('button');
    primaryButton.type = 'button';
    primaryButton.className = 'editor-modal-button is-primary';
    primaryButton.textContent = primaryLabel;

    actions.appendChild(cancelButton);
    actions.appendChild(primaryButton);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var api = {
      overlay: overlay,
      body: body,
      primaryButton: primaryButton,
      cancelButton: cancelButton,
      pending: false,
      close: function (force) {
        if (api.pending && !force) return;
        document.removeEventListener('keydown', onModalKeyDown, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (localEditor.modal === api) localEditor.modal = null;
      },
      setPending: function (pending) {
        api.pending = !!pending;
        primaryButton.disabled = api.pending;
        cancelButton.disabled = api.pending;
        var fields = modal.querySelectorAll('input, textarea, select');
        for (var i = 0; i < fields.length; i++) {
          fields[i].disabled = api.pending;
        }
        modal.classList.toggle('is-pending', api.pending);
      }
    };

    function onModalKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        api.close(false);
        return;
      }

      if (event.key === 'Tab') {
        var focusable = Array.prototype.filter.call(
          modal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), ' +
            'select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ),
          function (element) {
            return !element.hidden && element.getAttribute('aria-hidden') !== 'true';
          }
        );
        if (!focusable.length) {
          event.preventDefault();
          return;
        }

        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        var active = document.activeElement;
        if (!modal.contains(active)) {
          event.preventDefault();
          event.stopPropagation();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          event.stopPropagation();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          event.stopPropagation();
          first.focus();
        }
      }
    }

    cancelButton.addEventListener('click', function () {
      api.close(false);
    });
    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) api.close(false);
    });
    document.addEventListener('keydown', onModalKeyDown, true);
    localEditor.modal = api;
    return api;
  }

  function openFullEditorModal() {
    if (!localEditor.enabled || localEditor.busy || currentTranspose !== 0) return;

    var editor = createEditorModal('Editar cifra completa', 'Salvar');
    editor.overlay.classList.add('editor-modal-full');

    var textarea = document.createElement('textarea');
    textarea.className = 'editor-modal-input editor-modal-textarea';
    textarea.value = localEditor.preText;
    textarea.spellcheck = false;
    textarea.setAttribute('aria-label', 'Conteúdo completo da cifra');
    editor.body.appendChild(textarea);

    editor.primaryButton.addEventListener('click', function () {
      if (editor.pending) return;
      if (currentTranspose !== 0) {
        showLocalEditorNotification(
          'A edição completa está bloqueada enquanto o tom estiver transposto.',
          'error'
        );
        return;
      }
      if (textarea.value === localEditor.preText) {
        editor.close(true);
        return;
      }
      editor.setPending(true);
      saveLocalPreText(textarea.value, { successMessage: 'Cifra completa salva.' }).then(function () {
        editor.close(true);
      }).catch(function () {
        editor.setPending(false);
      });
    });

    window.setTimeout(function () {
      textarea.focus();
    }, 0);
  }

  function getTransposedPreText() {
    return getLocalEditorLines().map(function (line) {
      if (!isChordLine(line)) return line;
      return line.replace(CHORD_REGEX, function (chord) {
        return transposeChordSymbol(chord, currentTranspose);
      });
    }).join('\n');
  }

  function openRewriteModal() {
    if (!localEditor.enabled || localEditor.busy || currentTranspose === 0) return;

    var transposeAtOpen = currentTranspose;
    var editor = createEditorModal('Reescrever cifra', 'Reescrever');
    var message = document.createElement('p');
    message.textContent = 'Salvar no arquivo o tom exibido (' +
      formatTranspose(transposeAtOpen) + ') como o novo tom original?';
    editor.body.appendChild(message);

    editor.primaryButton.addEventListener('click', function () {
      if (editor.pending || currentTranspose !== transposeAtOpen) return;
      editor.setPending(true);
      saveLocalPreText(getTransposedPreText(), {
        resetTranspose: true,
        successMessage: 'Tom exibido salvo como novo original.'
      }).then(function () {
        editor.close(true);
      }).catch(function () {
        editor.setPending(false);
      });
    });
  }

  function replaceSelectedChord(replacement, targetOverride) {
    var selected = targetOverride || localEditor.selectedChord;
    if (!selected || localEditor.busy || currentTranspose !== 0) return Promise.resolve(false);

    var lines = getLocalEditorLines();
    var line = lines[selected.lineIndex];
    if (typeof line !== 'string') return Promise.resolve(false);
    if (line.slice(selected.start, selected.end) !== selected.text) {
      showLocalEditorNotification('A posição do acorde mudou. Selecione-o novamente.', 'error');
      return Promise.resolve(false);
    }

    var nextLine = line.slice(0, selected.start) + replacement + line.slice(selected.end);
    var nextText = buildPreTextWithLine(selected.lineIndex, nextLine);
    return saveLocalPreText(nextText, { lineElement: selected.lineElement });
  }

  function removeSelectedChord() {
    var selected = localEditor.selectedChord;
    if (!selected) return Promise.resolve(false);
    return replaceSelectedChord(new Array(selected.end - selected.start + 1).join(' '));
  }

  function openChordReplacementModal(initialValue, useCurrentValue) {
    var selected = localEditor.selectedChord;
    if (!selected || localEditor.busy || currentTranspose !== 0) return;
    var target = {
      element: selected.element,
      lineElement: selected.lineElement,
      lineIndex: selected.lineIndex,
      start: selected.start,
      end: selected.end,
      text: selected.text
    };

    var editor = createEditorModal('Substituir acorde', 'Substituir');
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'editor-modal-input';
    input.value = useCurrentValue ? target.text : (initialValue || '');
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Novo acorde');
    editor.body.appendChild(input);

    function submitReplacement() {
      if (editor.pending) return;
      if (currentTranspose !== 0) {
        showLocalEditorNotification(
          'A substituição está bloqueada enquanto o tom estiver transposto.',
          'error'
        );
        return;
      }
      var value = input.value;
      if (!value.trim()) {
        showLocalEditorNotification('Digite um acorde.', 'error');
        input.focus();
        input.select();
        return;
      }

      editor.setPending(true);
      replaceSelectedChord(value, target).then(function () {
        editor.close(true);
      }).catch(function () {
        editor.setPending(false);
      });
    }

    editor.primaryButton.addEventListener('click', submitReplacement);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitReplacement();
      }
    });

    window.setTimeout(function () {
      input.focus();
      if (useCurrentValue) input.select();
      else input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  }

  function openLineEditorModal(lineElement) {
    if (!lineElement || !localEditor.enabled || localEditor.busy || currentTranspose !== 0) return;
    var lineIndex = parseInt(lineElement.getAttribute('data-line-index'), 10);
    var lines = getLocalEditorLines();
    if (isNaN(lineIndex) || typeof lines[lineIndex] !== 'string') return;
    var originalLine = lines[lineIndex];
    var editor = createEditorModal('Editar linha completa', 'Salvar');
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'editor-modal-input editor-line-input';
    input.value = originalLine;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Conteúdo completo da linha');
    editor.body.appendChild(input);

    function submitLine() {
      if (editor.pending) return;
      if (input.value === originalLine) {
        editor.close(true);
        return;
      }
      var nextText = buildPreTextWithLine(lineIndex, input.value);
      if (nextText == null) return;
      editor.setPending(true);
      saveLocalPreText(nextText, {
        lineElement: lineElement,
        successMessage: 'Linha salva.'
      }).then(function () {
        editor.close(true);
      }).catch(function () {
        editor.setPending(false);
      });
    }

    editor.primaryButton.addEventListener('click', submitLine);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitLine();
      }
    });
    window.setTimeout(function () {
      input.focus();
      input.select();
    }, 0);
  }

  function clearSelectedChord() {
    var selected = localEditor.selectedChord;
    if (selected && selected.element) {
      selected.element.classList.remove('is-selected');
      selected.element.setAttribute('aria-selected', 'false');
    }
    localEditor.selectedChord = null;
  }

  function selectEditableChord(chordElement) {
    if (!chordElement || localEditor.modal || currentTranspose !== 0 || localEditor.busy) return false;
    var lineElement = chordElement.closest('.line-chord');
    if (!lineElement) return false;

    var lineIndex = parseInt(lineElement.getAttribute('data-line-index'), 10);
    var start = parseInt(chordElement.getAttribute('data-chord-start'), 10);
    var end = parseInt(chordElement.getAttribute('data-chord-end'), 10);
    if (isNaN(lineIndex) || isNaN(start) || isNaN(end)) return false;

    clearSelectedChord();
    chordElement.classList.add('is-selected');
    chordElement.setAttribute('aria-selected', 'true');
    localEditor.selectedChord = {
      element: chordElement,
      lineElement: lineElement,
      lineIndex: lineIndex,
      start: start,
      end: end,
      text: chordElement.textContent || ''
    };
    return true;
  }

  function hideEditorContextMenu() {
    if (localEditor && localEditor.contextMenu) localEditor.contextMenu.hidden = true;
  }

  function createEditorContextMenu() {
    if (localEditor.contextMenu) return;

    var menu = document.createElement('div');
    menu.className = 'chord-context-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');

    var editOption = document.createElement('button');
    editOption.type = 'button';
    editOption.className = 'chord-context-menu-item';
    editOption.textContent = 'Editar';
    editOption.setAttribute('role', 'menuitem');
    editOption.addEventListener('click', function (event) {
      event.stopPropagation();
      hideEditorContextMenu();
      openChordReplacementModal('', true);
    });

    var removeOption = document.createElement('button');
    removeOption.type = 'button';
    removeOption.className = 'chord-context-menu-item is-danger';
    removeOption.textContent = 'Remover';
    removeOption.setAttribute('role', 'menuitem');
    removeOption.addEventListener('click', function (event) {
      event.stopPropagation();
      hideEditorContextMenu();
      removeSelectedChord().catch(function () {});
    });

    menu.appendChild(editOption);
    menu.appendChild(removeOption);
    document.body.appendChild(menu);
    localEditor.contextMenu = menu;
  }

  function showEditorContextMenu(x, y) {
    createEditorContextMenu();
    var menu = localEditor.contextMenu;
    menu.hidden = false;
    menu.style.left = Math.max(8, x) + 'px';
    menu.style.top = Math.max(8, y) + 'px';

    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      menu.style.left = Math.max(8, window.innerWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > window.innerHeight - 8) {
      menu.style.top = Math.max(8, window.innerHeight - rect.height - 8) + 'px';
    }
  }

  function isEditorInputTarget(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  function handleLocalEditorKeyDown(event) {
    if (!localEditor.enabled || localEditor.modal || localEditor.busy || currentTranspose !== 0) return;
    if (isEditorInputTarget(event.target)) return;

    if (event.key === 'Escape') {
      hideEditorContextMenu();
      clearSelectedChord();
      return;
    }

    var selected = localEditor.selectedChord;
    if (!selected || !selected.element || !selected.element.isConnected) return;

    if (event.key === 'Delete') {
      event.preventDefault();
      hideEditorContextMenu();
      removeSelectedChord().catch(function () {});
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      hideEditorContextMenu();
      var direction = event.key === 'ArrowLeft' ? -1 : 1;
      var line = getLocalEditorLines()[selected.lineIndex];
      var targetStart = selected.start + direction;
      var nextLine = placeChordWithPush(
        line,
        selected.text,
        targetStart,
        direction,
        selected.start,
        selected.end
      );
      if (nextLine == null) {
        showLocalEditorNotification('Não há espaço para mover esse acorde.', 'error');
        return;
      }
      var nextText = buildPreTextWithLine(selected.lineIndex, nextLine);
      if (nextText !== localEditor.preText) {
        saveLocalPreText(nextText, {
          lineElement: selected.lineElement,
          restoreSelection: {
            lineIndex: selected.lineIndex,
            start: targetStart,
            text: selected.text
          }
        }).catch(function () {});
      }
      return;
    }

    if (event.key && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      hideEditorContextMenu();
      openChordReplacementModal(event.key, false);
    }
  }

  function getLineColumnFromPointer(lineElement, clientX) {
    var measure = document.createElement('span');
    var computed = window.getComputedStyle(lineElement);
    measure.textContent = 'MMMMMMMMMM';
    measure.style.position = 'fixed';
    measure.style.visibility = 'hidden';
    measure.style.whiteSpace = 'pre';
    measure.style.font = computed.font;
    measure.style.letterSpacing = computed.letterSpacing;
    document.body.appendChild(measure);
    var characterWidth = measure.getBoundingClientRect().width / 10;
    document.body.removeChild(measure);
    if (!characterWidth || !isFinite(characterWidth)) characterWidth = 8;

    var lineRect = lineElement.getBoundingClientRect();
    return Math.round((clientX - lineRect.left) / characterWidth);
  }

  function composeChordLayout(line, placements) {
    var originalChords = getChordMatches(line);
    var characters = line.split('');
    var i;
    var j;

    for (i = 0; i < originalChords.length; i++) {
      for (j = originalChords[i].start; j < originalChords[i].end; j++) {
        characters[j] = ' ';
      }
    }

    placements.sort(function (a, b) { return a.start - b.start; });
    for (i = 0; i < placements.length; i++) {
      var placement = placements[i];
      if (placement.start < 0) return null;
      while (characters.length < placement.start + placement.text.length) characters.push(' ');
      for (j = 0; j < placement.text.length; j++) {
        var existing = characters[placement.start + j];
        if (existing && !/\s/.test(existing)) return null;
      }
      for (j = 0; j < placement.text.length; j++) {
        characters[placement.start + j] = placement.text.charAt(j);
      }
    }

    return characters.join('');
  }

  function placeChordWithPush(line, chordText, targetStart, direction, sourceStart, sourceEnd) {
    var matches = getChordMatches(line);
    var otherChords = [];
    var sourceFound = sourceStart == null;

    for (var i = 0; i < matches.length; i++) {
      var chord = matches[i];
      if (!sourceFound && chord.start === sourceStart && chord.end === sourceEnd) {
        sourceFound = true;
        continue;
      }
      otherChords.push({ text: chord.text, start: chord.start, end: chord.end });
    }
    if (!sourceFound) return null;

    if (targetStart < 0) return null;
    var moving = {
      text: chordText,
      start: targetStart,
      end: targetStart + chordText.length
    };
    var placements = [moving];

    otherChords.sort(function (a, b) { return a.start - b.start; });
    if (direction >= 0) {
      var cursorEnd = moving.end;
      for (i = 0; i < otherChords.length; i++) {
        var rightChord = otherChords[i];
        if (rightChord.end <= moving.start - 1) {
          placements.push(rightChord);
          continue;
        }
        var rightStart = Math.max(rightChord.start, cursorEnd + 1);
        placements.push({
          text: rightChord.text,
          start: rightStart,
          end: rightStart + rightChord.text.length
        });
        cursorEnd = rightStart + rightChord.text.length;
      }
    } else {
      var before = [];
      var after = [];
      for (i = 0; i < otherChords.length; i++) {
        if (otherChords[i].start >= moving.end + 1) after.push(otherChords[i]);
        else before.push(otherChords[i]);
      }

      var cursorStart = moving.start;
      for (i = before.length - 1; i >= 0; i--) {
        var leftChord = before[i];
        var leftStart = Math.min(leftChord.start, cursorStart - leftChord.text.length - 1);
        if (leftStart < 0) return null;
        placements.push({
          text: leftChord.text,
          start: leftStart,
          end: leftStart + leftChord.text.length
        });
        cursorStart = leftStart;
      }
      placements = placements.concat(after);
    }

    return composeChordLayout(line, placements);
  }

  function clearEditorDropTargets() {
    if (!localEditor.pre) return;
    var targets = localEditor.pre.querySelectorAll('.line-chord.is-drop-target');
    for (var i = 0; i < targets.length; i++) targets[i].classList.remove('is-drop-target');
  }

  function clearEditorDragState() {
    clearEditorDropTargets();
    if (localEditor.drag && localEditor.drag.element) {
      localEditor.drag.element.classList.remove('is-dragging');
    }
    localEditor.drag = null;
  }

  function canDropEditorDragOnLine(lineElement) {
    if (!localEditor.drag || localEditor.busy || currentTranspose !== 0 || !lineElement) return false;
    if (localEditor.drag.type === 'line') {
      return localEditor.drag.lineIndex === parseInt(lineElement.getAttribute('data-line-index'), 10);
    }
    return localEditor.drag.type === 'palette';
  }

  function handleEditorDragStart(event) {
    if (localEditor.busy || currentTranspose !== 0) return;
    var chordElement = event.target.closest && event.target.closest('.editable-chord');
    if (!chordElement || !selectEditableChord(chordElement)) return;
    var selected = localEditor.selectedChord;
    var pointerColumn = getLineColumnFromPointer(selected.lineElement, event.clientX);
    var grabOffset = Math.max(0, Math.min(
      selected.text.length - 1,
      pointerColumn - selected.start
    ));
    chordElement.classList.add('is-dragging');
    localEditor.drag = {
      type: 'line',
      text: selected.text,
      element: chordElement,
      lineIndex: selected.lineIndex,
      start: selected.start,
      end: selected.end,
      grabOffset: grabOffset
    };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', selected.text);
    }
  }

  function handleEditorDragOver(event) {
    var lineElement = event.target.closest && event.target.closest('.line-chord');
    if (!canDropEditorDragOnLine(lineElement)) return;
    event.preventDefault();
    clearEditorDropTargets();
    lineElement.classList.add('is-drop-target');
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = localEditor.drag.type === 'palette' ? 'copy' : 'move';
    }
  }

  function handleEditorDragLeave(event) {
    var lineElement = event.target.closest && event.target.closest('.line-chord');
    if (!lineElement) return;
    var nextTarget = event.relatedTarget;
    if (!nextTarget || !lineElement.contains(nextTarget)) lineElement.classList.remove('is-drop-target');
  }

  function handleEditorDrop(event) {
    var lineElement = event.target.closest && event.target.closest('.line-chord');
    if (!canDropEditorDragOnLine(lineElement)) return;
    event.preventDefault();
    event.stopPropagation();

    var drag = localEditor.drag;
    var lineIndex = parseInt(lineElement.getAttribute('data-line-index'), 10);
    var line = getLocalEditorLines()[lineIndex];
    var pointerColumn = getLineColumnFromPointer(lineElement, event.clientX);
    var targetColumn = drag.type === 'palette' ?
      Math.max(0, pointerColumn) : pointerColumn - drag.grabOffset;
    var direction = drag.type === 'palette' ? 1 : (targetColumn < drag.start ? -1 : 1);
    var nextLine = placeChordWithPush(
      line,
      drag.text,
      targetColumn,
      direction,
      drag.type === 'line' ? drag.start : null,
      drag.type === 'line' ? drag.end : null
    );

    if (nextLine == null) {
      showLocalEditorNotification(
        direction < 0 ? 'Não há espaço à esquerda para mover esse acorde.' : 'Não foi possível inserir nesse ponto.',
        'error'
      );
      clearEditorDragState();
      return;
    }

    var nextText = buildPreTextWithLine(lineIndex, nextLine);
    localEditor.suppressClick = drag.type === 'line';
    clearEditorDragState();
    if (nextText !== localEditor.preText) {
      saveLocalPreText(nextText, { lineElement: lineElement }).catch(function () {});
    }
    window.setTimeout(function () { localEditor.suppressClick = false; }, 300);
  }

  function handleEditorDragEnd() {
    clearEditorDragState();
  }

  function getPaletteChordSymbols() {
    if (!localEditor.pre) return [];
    var lineElements = localEditor.pre.querySelectorAll('.line-chord');
    var seen = Object.create(null);
    var chords = [];

    for (var i = 0; i < lineElements.length; i++) {
      var matches = getChordMatches(lineElements[i].textContent || '');
      for (var j = 0; j < matches.length; j++) {
        var chord = matches[j].text;
        if (!seen[chord]) {
          seen[chord] = true;
          chords.push(chord);
        }
      }
    }

    chords.sort(function (a, b) {
      var rootA = a.match(/^([A-G][#b]?)/);
      var rootB = b.match(/^([A-G][#b]?)/);
      var indexA = rootA ? NOTES_SHARP.indexOf(normalizeNote(rootA[1])) : 99;
      var indexB = rootB ? NOTES_SHARP.indexOf(normalizeNote(rootB[1])) : 99;
      if (indexA !== indexB) return indexA - indexB;
      return a.localeCompare(b, 'pt-BR');
    });
    return chords;
  }

  function startPaletteChordDrag(event, item, chord) {
    if (localEditor.busy || currentTranspose !== 0) {
      event.preventDefault();
      return;
    }
    item.classList.add('is-dragging');
    localEditor.drag = {
      type: 'palette',
      text: chord,
      element: item
    };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', chord);
    }
  }

  function renderChordPalette() {
    if (!localEditor.paletteGrid) return;
    var chords = getPaletteChordSymbols();
    var locked = currentTranspose !== 0 || localEditor.busy;
    if (localEditor.pre) {
      var preStyle = window.getComputedStyle(localEditor.pre);
      localEditor.paletteGrid.style.fontFamily = preStyle.fontFamily;
      localEditor.paletteGrid.style.fontSize = preStyle.fontSize;
      localEditor.paletteGrid.style.lineHeight = preStyle.lineHeight;
    }
    localEditor.paletteGrid.innerHTML = '';

    chords.forEach(function (chord) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'chord-palette-item';
      item.textContent = chord;
      item.draggable = !locked;
      item.disabled = locked;
      item.setAttribute('data-chord', chord);
      item.setAttribute('aria-label', locked ?
        'Acorde ' + chord + ' (edição bloqueada durante transposição)' :
        'Arrastar acorde ' + chord);
      item.addEventListener('dragstart', function (event) {
        startPaletteChordDrag(event, item, chord);
      });
      item.addEventListener('dragend', handleEditorDragEnd);
      localEditor.paletteGrid.appendChild(item);
    });

    localEditor.palette.classList.toggle('is-empty', chords.length === 0);
    if (localEditor.paletteEmpty) localEditor.paletteEmpty.hidden = chords.length !== 0;
  }

  function getPaletteStorageKey() {
    var slash = localEditor.path.lastIndexOf('/');
    var folder = slash === -1 ? '' : localEditor.path.slice(0, slash);
    return 'chord-editor-palette-position:' + folder;
  }

  function readPalettePosition() {
    try {
      var value = JSON.parse(window.localStorage.getItem(getPaletteStorageKey()));
      if (value && isFinite(value.left) && isFinite(value.top)) return value;
    } catch (error) {}
    return null;
  }

  function savePalettePosition(left, top) {
    try {
      window.localStorage.setItem(getPaletteStorageKey(), JSON.stringify({ left: left, top: top }));
    } catch (error) {}
  }

  function createChordPalette() {
    if (!localEditor.enabled || localEditor.palette) return;

    var palette = document.createElement('aside');
    palette.className = 'chord-palette';
    palette.setAttribute('aria-label', 'Acordes usados na cifra');

    var title = document.createElement('h2');
    title.className = 'chord-palette-title';
    title.textContent = 'Acordes';

    var grid = document.createElement('div');
    grid.className = 'chord-palette-grid';

    var empty = document.createElement('p');
    empty.className = 'chord-palette-empty';
    empty.textContent = 'Nenhum acorde';

    palette.appendChild(title);
    palette.appendChild(grid);
    palette.appendChild(empty);
    document.body.appendChild(palette);
    localEditor.palette = palette;
    localEditor.paletteGrid = grid;
    localEditor.paletteEmpty = empty;
    title.addEventListener('pointerdown', startPaletteMove);
    renderChordPalette();
    updatePalettePosition();
  }

  function measureEditorCharacterWidth(element) {
    var measure = document.createElement('span');
    var computed = window.getComputedStyle(element);
    measure.textContent = 'MMMMMMMMMM';
    measure.style.position = 'fixed';
    measure.style.visibility = 'hidden';
    measure.style.whiteSpace = 'pre';
    measure.style.font = computed.font;
    measure.style.letterSpacing = computed.letterSpacing;
    document.body.appendChild(measure);
    var width = measure.getBoundingClientRect().width / 10;
    document.body.removeChild(measure);
    return width && isFinite(width) ? width : 8;
  }

  function updatePalettePosition() {
    var palette = localEditor.palette;
    var pre = localEditor.pre;
    if (!palette || !pre) return;

    var preRect = pre.getBoundingClientRect();
    var preStyle = window.getComputedStyle(pre);
    var contentLeft = preRect.left + (parseFloat(preStyle.paddingLeft) || 0);
    var lineElements = pre.querySelectorAll('.line');
    var maximumColumns = 0;
    for (var i = 0; i < lineElements.length; i++) {
      maximumColumns = Math.max(maximumColumns, (lineElements[i].textContent || '').length);
    }
    var contentRight = contentLeft + maximumColumns * measureEditorCharacterWidth(pre);
    var referenceRight = contentRight;
    var iframe = document.querySelector('iframe.sticky-top');
    if (iframe) {
      var iframeRect = iframe.getBoundingClientRect();
      if (iframeRect.width && iframeRect.height) referenceRight = Math.max(referenceRight, iframeRect.right);
    }

    var horizontalGap = 36;
    var viewportGap = 20;
    var desiredLeft = referenceRight + horizontalGap;
    palette.style.left = '0px';
    palette.style.top = '0px';
    palette.style.visibility = 'hidden';
    palette.classList.add('is-positioned');
    var rect = palette.getBoundingClientRect();
    var stored = readPalettePosition();
    var desiredTop = stored ? stored.top : Math.max(viewportGap, (window.innerHeight - rect.height) / 2);
    if (!stored && desiredLeft + rect.width > window.innerWidth - viewportGap) {
      desiredLeft = window.innerWidth - rect.width - viewportGap;
    } else if (stored) {
      desiredLeft = stored.left;
    }
    var maximumLeft = Math.max(viewportGap, window.innerWidth - rect.width - viewportGap);
    var maximumTop = Math.max(viewportGap, window.innerHeight - rect.height - viewportGap);
    palette.style.left = Math.round(Math.max(viewportGap, Math.min(desiredLeft, maximumLeft))) + 'px';
    palette.style.top = Math.round(Math.max(viewportGap, Math.min(desiredTop, maximumTop))) + 'px';
    palette.style.visibility = '';
    palette.setAttribute('aria-hidden', 'false');
  }

  function startPaletteMove(event) {
    if (!localEditor.palette || event.button > 0) return;
    event.preventDefault();
    var rect = localEditor.palette.getBoundingClientRect();
    localEditor.paletteDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    localEditor.palette.classList.add('is-moving');
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePalette(event) {
    var drag = localEditor.paletteDrag;
    var palette = localEditor.palette;
    if (!drag || !palette || event.pointerId !== drag.pointerId) return;
    var rect = palette.getBoundingClientRect();
    var gap = 8;
    var left = Math.max(gap, Math.min(event.clientX - drag.offsetX, window.innerWidth - rect.width - gap));
    var top = Math.max(gap, Math.min(event.clientY - drag.offsetY, window.innerHeight - rect.height - gap));
    palette.style.left = Math.round(left) + 'px';
    palette.style.top = Math.round(top) + 'px';
  }

  function stopPaletteMove(event) {
    var drag = localEditor.paletteDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    localEditor.paletteDrag = null;
    localEditor.palette.classList.remove('is-moving');
    savePalettePosition(parseFloat(localEditor.palette.style.left), parseFloat(localEditor.palette.style.top));
  }

  function initLocalEditorInteractions() {
    if (localEditor.interactionsInitialized || !localEditor.pre) return;
    localEditor.interactionsInitialized = true;
    createEditorContextMenu();

    localEditor.pre.addEventListener('click', function (event) {
      var editButton = event.target.closest && event.target.closest('.line-edit-button');
      if (editButton) {
        event.preventDefault();
        event.stopPropagation();
        openLineEditorModal(editButton.closest('.line'));
        return;
      }
      var chordElement = event.target.closest && event.target.closest('.editable-chord');
      if (!chordElement) return;
      if (localEditor.suppressClick) {
        localEditor.suppressClick = false;
        event.preventDefault();
        return;
      }
      if (selectEditableChord(chordElement)) {
        event.stopPropagation();
        try {
          chordElement.focus({ preventScroll: true });
        } catch (e) {
          chordElement.focus();
        }
      }
    });

    localEditor.pre.addEventListener('focusin', function (event) {
      var chordElement = event.target.closest && event.target.closest('.editable-chord');
      if (chordElement) selectEditableChord(chordElement);
    });

    localEditor.pre.addEventListener('contextmenu', function (event) {
      var chordElement = event.target.closest && event.target.closest('.editable-chord');
      if (!chordElement || currentTranspose !== 0 || localEditor.busy) return;
      event.preventDefault();
      if (selectEditableChord(chordElement)) showEditorContextMenu(event.clientX, event.clientY);
    });
    localEditor.pre.addEventListener('dragstart', handleEditorDragStart);
    localEditor.pre.addEventListener('dragover', handleEditorDragOver);
    localEditor.pre.addEventListener('dragleave', handleEditorDragLeave);
    localEditor.pre.addEventListener('drop', handleEditorDrop);
    localEditor.pre.addEventListener('dragend', handleEditorDragEnd);

    document.addEventListener('keydown', handleLocalEditorKeyDown);
    document.addEventListener('click', function (event) {
      if (event.target.closest && (
        event.target.closest('.editable-chord') ||
        event.target.closest('.chord-context-menu') ||
        event.target.closest('.editor-modal')
      )) return;
      hideEditorContextMenu();
      clearSelectedChord();
    });

    window.addEventListener('resize', updatePalettePosition);
    document.addEventListener('pointermove', movePalette);
    document.addEventListener('pointerup', stopPaletteMove);
    document.addEventListener('pointercancel', stopPaletteMove);
  }

  function refreshLocalEditorUi() {
    if (!localEditor.enabled) return;

    var editingLocked = currentTranspose !== 0 || localEditor.busy;
    if (editingLocked) {
      hideEditorContextMenu();
      clearSelectedChord();
    }
    if (localEditor.editButton) {
      localEditor.editButton.disabled = editingLocked;
      localEditor.editButton.title = currentTranspose !== 0 ?
        'Volte o tom para 0 ou use Reescrever' : 'Editar';
    }
    if (localEditor.rewriteButton) {
      localEditor.rewriteButton.hidden = currentTranspose === 0;
      localEditor.rewriteButton.style.display = currentTranspose === 0 ? 'none' : '';
      localEditor.rewriteButton.disabled = localEditor.busy;
    }

    if (localEditor.pre) {
      var chordEls = localEditor.pre.querySelectorAll('.editable-chord');
      for (var i = 0; i < chordEls.length; i++) {
        chordEls[i].draggable = !editingLocked;
        chordEls[i].tabIndex = editingLocked ? -1 : 0;
        chordEls[i].setAttribute('aria-disabled', editingLocked ? 'true' : 'false');
      }
      var lineButtons = localEditor.pre.querySelectorAll('.line-edit-button');
      for (var j = 0; j < lineButtons.length; j++) lineButtons[j].disabled = editingLocked;
    }

    renderChordPalette();
    updatePalettePosition();
  }

  function initLocalEditor() {
    var protocol = window.location.protocol;
    if (protocol === 'https:') return;
    if (protocol === 'file:') {
      showLocalEditorGuidance();
      return;
    }
    if (protocol !== 'http:') return;
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return;

    var pre = document.querySelector('body > pre');
    if (!pre) return;
    var serverConfirmed = false;

    fetch('/__chord_editor__/health', {
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(function (response) {
      if (!response.ok) throw new Error('Servidor local do editor indisponível');
      serverConfirmed = true;

      localEditor.path = getLocalDocumentPath();
      var query = new URLSearchParams({ path: localEditor.path });
      return fetchEditorJson('/__chord_editor__/document?' + query.toString());
    }).then(function (documentData) {
      if (typeof documentData.preText !== 'string' || documentData.revision == null) {
        throw new Error('Resposta inválida do servidor local');
      }

      localEditor.enabled = true;
      localEditor.pre = pre;
      localEditor.preText = documentData.preText;
      localEditor.revision = documentData.revision;
      pre.setAttribute('data-original-text', localEditor.preText);
      document.body.classList.add('local-editor-enabled');

      processPre(pre, currentTranspose);
      createLocalEditorToolbarButtons(document.querySelector('.toolbar-extra-row'));
      initLocalEditorInteractions();
      createChordPalette();
      refreshLocalEditorUi();
    }).catch(function (error) {
      // Um HTTP comum não possui os endpoints do editor; nesse caso a página
      // segue funcionando normalmente, sem controles ou listeners de edição.
      if (localEditor.enabled || serverConfirmed) {
        showLocalEditorNotification(error.message || 'Não foi possível iniciar o editor local.', 'error');
      } else {
        console.info('Editor local não ativado:', error.message || error);
      }
    });
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
    'adorá-lo': true,
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
      // IA / agentes: ao copiar ou editar esta pasta para outro culto,
      // atualizar este prefixo para a data da pasta. Manter o formato
      // AAAA-MM-DD_holyrics-letra.json ou AAAA-MM-DD_holyrics-cifra.json.
      downloadJson('2026-08-02_holyrics-' + suffix + '.json', songs);
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
    initLocalEditor();
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
      updatePalettePosition();
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
