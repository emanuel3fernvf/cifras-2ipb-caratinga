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
      }).join('\n');
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
    if (document.querySelector('.video-sticky-toggle')) return;

    var iframe = document.querySelector('iframe.sticky-top');
    if (!iframe) return;

    // Garante que começa não fixo
    iframe.classList.remove('sticky-fixed');

    var container = document.createElement('div');
    container.style.textAlign = 'left';
    container.style.margin = '4px 0 8px 0';

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

    container.appendChild(toneLabel);
    container.appendChild(toneValue);
    container.appendChild(btnToneDown);
    container.appendChild(btnToneUp);
    btnToneReset.addEventListener('click', function () {
      currentTranspose = 0;
      applyTransposeToAllPres();
    });
    container.appendChild(btnToneReset);
    container.appendChild(btnSticky);

    // Insere logo após o iframe
    if (iframe.parentNode) {
      iframe.parentNode.insertBefore(container, iframe.nextSibling);
    } else {
      document.body.insertBefore(container, document.body.firstChild);
    }
  }

  function init() {
    // Carrega transposição inicial da URL (parâmetro ?tr=)
    currentTranspose = getTransposeFromUrl();

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
    container.className = 'top-tone-controls';
    container.style.position = 'sticky';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.zIndex = '250';
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.alignItems = 'center';
    container.style.gap = '6px';
    container.style.padding = '8px 10px';
    container.style.marginBottom = '8px';
    container.style.background = '#fff';
    container.style.borderBottom = '1px solid #ddd';

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

    container.appendChild(toneLabel);
    container.appendChild(toneValue);
    container.appendChild(btnToneDown);
    container.appendChild(btnToneUp);
    container.appendChild(btnToneReset);

    document.body.insertBefore(container, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
