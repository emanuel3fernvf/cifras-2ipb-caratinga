/**
 * Destaca linhas que contêm apenas cifras (acordes) com fundo laranja.
 * Roda ao carregar a página em todas as páginas que tenham <pre> com cifra.
 */
(function () {
  'use strict';

  // Acorde: nota (A-G, opcional #/b) + qualidade (m, maj, dim, etc.) + número (+ opcional M, ex: G7M) + opcional /baixo
  var CHORD_REGEX = /[A-G][#b]?(?:m|min|maj|dim|aug|sus|add)?[0-9]*(?:M)?(?:\/[A-G][#b]?)?/g;

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

  // --- Scroll automático ---
  var isScrolling = false;
  var speed = 20; // pixels por segundo (valor inicial)
  var minSpeed = 5;
  var maxSpeed = 200;
  var lastTs = null;
  var pendingScroll = 0; // acumula frações de pixel para velocidades baixas

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
    container.style.textAlign = 'right';
    container.style.margin = '4px 0 8px 0';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'video-sticky-toggle';
    btn.textContent = 'Fixar vídeo';

    var fixed = false;
    btn.addEventListener('click', function () {
      fixed = !fixed;
      if (fixed) {
        iframe.classList.add('sticky-fixed');
        btn.textContent = 'Soltar vídeo';
      } else {
        iframe.classList.remove('sticky-fixed');
        btn.textContent = 'Fixar vídeo';
      }
    });

    container.appendChild(btn);
    // Insere logo após o iframe
    if (iframe.parentNode) {
      iframe.parentNode.insertBefore(container, iframe.nextSibling);
    } else {
      document.body.insertBefore(container, document.body.firstChild);
    }
  }

  function init() {
    var pres = document.querySelectorAll('body > pre');
    for (var i = 0; i < pres.length; i++) {
      processPre(pres[i]);
    }
    createAutoScrollPanel();
    createVideoStickyToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
