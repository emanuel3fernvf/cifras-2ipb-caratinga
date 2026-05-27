/**
 * Destaca linhas que contêm apenas cifras (acordes) com fundo laranja.
 * Roda ao carregar a página em todas as páginas que tenham <pre> com cifra.
 */
(function () {
  'use strict';

  // Acorde: nota (A-G, opcional #/b) + qualidade (m, maj, dim, etc.) + número (+ opcional M, ex: G7M) + opcional /baixo
  var CHORD_REGEX = /[A-G][#b]?(?:m|min|maj|dim|aug|sus|add)?[0-9]*(?:M)?(?:\/[A-G][#b]?)?/g;

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
  var pendingScroll = 0;

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

    var delta = (timestamp - lastTs) / 1000;
    lastTs = timestamp;

    pendingScroll += speed * delta;
    var step = Math.floor(pendingScroll);
    if (step >= 1) {
      pendingScroll -= step;
      window.scrollBy(0, step);
    }

    if (window.innerHeight + window.scrollY >= document.body.scrollHeight) {
      isScrolling = false;
      lastTs = null;
      return;
    }

    window.requestAnimationFrame(stepScroll);
  }

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

  function updateTransposeDisplay() {
    if (!transposeDisplayEl) return;
    transposeDisplayEl.textContent = formatTranspose(currentTranspose);
  }

  function applyTranspose(semitones) {
    currentTranspose = semitones;
    setTransposeInUrl(semitones);
    document.querySelectorAll('pre').forEach(function (pre) {
      processPre(pre, semitones);
    });
    updateTransposeDisplay();
  }

  function createControlPanel() {
    var panel = document.createElement('div');
    panel.className = 'auto-scroll-panel';

    var btnPlay = document.createElement('button');
    btnPlay.textContent = '▶';
    btnPlay.type = 'button';
    btnPlay.addEventListener('click', function () {
      if (isScrolling) return;
      isScrolling = true;
      lastTs = null;
      window.requestAnimationFrame(stepScroll);
    });

    var btnPause = document.createElement('button');
    btnPause.textContent = '■';
    btnPause.type = 'button';
    btnPause.addEventListener('click', function () {
      isScrolling = false;
    });

    var btnFaster = document.createElement('button');
    btnFaster.textContent = '+';
    btnFaster.type = 'button';
    btnFaster.addEventListener('click', function () {
      speed = Math.min(maxSpeed, speed + 5);
    });

    var btnSlower = document.createElement('button');
    btnSlower.textContent = '-';
    btnSlower.type = 'button';
    btnSlower.addEventListener('click', function () {
      speed = Math.max(minSpeed, speed - 5);
    });

    var speedDisplay = document.createElement('span');
    speedDisplay.className = 'auto-scroll-speed';
    speedDisplay.textContent = speed;

    var transposeLabel = document.createElement('label');
    transposeLabel.textContent = 'Tr: ';
    transposeDisplayEl = document.createElement('span');
    transposeDisplayEl.textContent = formatTranspose(currentTranspose);
    transposeLabel.appendChild(transposeDisplayEl);

    panel.appendChild(btnPlay);
    panel.appendChild(btnPause);
    panel.appendChild(btnSlower);
    panel.appendChild(btnFaster);
    panel.appendChild(speedDisplay);
    panel.appendChild(transposeLabel);

    document.body.appendChild(panel);

    setInterval(function () {
      speedDisplay.textContent = speed;
    }, 200);
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTranspose(getTransposeFromUrl());
    createControlPanel();

    document.querySelectorAll('pre').forEach(function (pre) {
      processPre(pre, currentTranspose);
    });
  });
})();
