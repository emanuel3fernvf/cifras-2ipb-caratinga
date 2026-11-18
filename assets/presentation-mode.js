(function () {
  'use strict';

  if (!/\/index\.html?$/i.test(window.location.pathname)) return;

  var scriptEl = document.currentScript;
  var scriptUrl = (scriptEl && scriptEl.src) || '';
  var CHORD_REGEX = /[A-G][#b]?(?:m|min|maj|dim|aug|sus|add|°)?[0-9]*(?:M)?(?:\/([A-G][#b]?))?/g;

  var STORAGE_MODE = 'catalog-presentation-mode';
  var STORAGE_VIEW = 'catalog-presentation-view';
  var STORAGE_BG = 'catalog-presentation-bg';
  var STORAGE_FONT = 'catalog-presentation-font';

  var MIN_FONT = 75;
  var MAX_FONT = 200;
  var FONT_STEP = 5;
  var BASE_FONT_PX = 42;
  var EMPTY_MESSAGE = 'Sem letra apresentável';

  var modeOn = false;
  var viewMode = 'slide';
  var bgDataUrl = '';
  var fontPercent = 100;
  var strophes = [];
  var currentIndex = 0;
  var digitBuffer = '';
  var modalOpen = false;
  var loading = false;

  var toggleBtn;
  var prefsRow;
  var bgBtn;
  var bgInput;
  var bgPickerModal;
  var scrollBtn;
  var slideBtn;
  var modal;
  var modalBg;
  var stage;
  var digitHint;
  var bgWarning;
  var touchMoved = false;
  var touchStartX = 0;
  var touchStartY = 0;

  function loadCss() {
    if (!scriptUrl) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    try {
      var url = new URL(scriptUrl);
      link.href = new URL('presentation-mode.css' + url.search, scriptUrl).href;
    } catch (err) {
      link.href = scriptUrl.replace(/presentation-mode\.js(?:\?.*)?$/i, 'presentation-mode.css');
    }
    document.head.appendChild(link);
  }

  function isChordLine(line) {
    var trimmed = String(line || '').trim();
    if (!trimmed) return false;
    var withoutChords = trimmed.replace(CHORD_REGEX, '');
    var withoutSpaces = withoutChords.replace(/\s/g, '');
    if (!withoutSpaces) return true;
    if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(withoutSpaces)) return false;
    return true;
  }

  function isBracketLine(line) {
    return /[\[\]]/.test(String(line || ''));
  }

  function readStorage(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function loadPreferences() {
    modeOn = readStorage(STORAGE_MODE, '0') === '1';
    var view = readStorage(STORAGE_VIEW, 'slide');
    viewMode = view === 'scroll' ? 'scroll' : 'slide';
    bgDataUrl = readStorage(STORAGE_BG, '') || '';
    var font = parseInt(readStorage(STORAGE_FONT, '100'), 10);
    fontPercent = isFinite(font) ? Math.max(MIN_FONT, Math.min(MAX_FONT, font)) : 100;
  }

  function saveMode(on) {
    modeOn = !!on;
    writeStorage(STORAGE_MODE, modeOn ? '1' : '0');
  }

  function saveView(mode) {
    viewMode = mode === 'scroll' ? 'scroll' : 'slide';
    writeStorage(STORAGE_VIEW, viewMode);
  }

  function saveFont(percent) {
    fontPercent = Math.max(MIN_FONT, Math.min(MAX_FONT, percent));
    writeStorage(STORAGE_FONT, String(fontPercent));
  }

  function saveBackground(dataUrl) {
    bgDataUrl = dataUrl || '';
    if (!bgDataUrl) {
      try { window.localStorage.removeItem(STORAGE_BG); } catch (err) { /* ignore */ }
      return true;
    }
    var ok = writeStorage(STORAGE_BG, bgDataUrl);
    if (!ok) {
      bgDataUrl = '';
      try { window.localStorage.removeItem(STORAGE_BG); } catch (err2) { /* ignore */ }
      showBgWarning();
      return false;
    }
    return true;
  }

  function showBgWarning() {
    if (!bgWarning) return;
    bgWarning.hidden = false;
    bgWarning.textContent = 'Fundo não pôde ser salvo; usando preto.';
    window.setTimeout(function () {
      if (bgWarning) bgWarning.hidden = true;
    }, 3200);
  }

  function preferredFontPx() {
    return Math.round(BASE_FONT_PX * fontPercent / 100);
  }

  function applyIndexAppearance() {
    document.body.classList.toggle('presentation-mode-on', modeOn);
    if (toggleBtn) {
      toggleBtn.classList.toggle('is-active', modeOn);
      toggleBtn.setAttribute('aria-pressed', modeOn ? 'true' : 'false');
      toggleBtn.textContent = 'Modo de apresentação';
    }
    if (prefsRow) prefsRow.hidden = !modeOn;
    updateViewButtons();
  }

  function updateViewButtons() {
    if (scrollBtn) {
      scrollBtn.classList.toggle('is-active', viewMode === 'scroll');
      scrollBtn.setAttribute('aria-pressed', viewMode === 'scroll' ? 'true' : 'false');
    }
    if (slideBtn) {
      slideBtn.classList.toggle('is-active', viewMode === 'slide');
      slideBtn.setAttribute('aria-pressed', viewMode === 'slide' ? 'true' : 'false');
    }
  }

  function ensureActions() {
    var actions = document.querySelector('.index-actions');
    if (actions) return actions;
    var content = document.getElementById('content');
    actions = document.createElement('div');
    actions.className = 'index-actions';
    if (content && content.parentNode) {
      content.parentNode.insertBefore(actions, content);
    } else {
      document.body.insertBefore(actions, document.body.firstChild);
    }
    return actions;
  }

  function insertToggle(actions) {
    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'presentation-mode-toggle';
    toggleBtn.id = 'presentation-mode-btn';
    toggleBtn.textContent = 'Modo de apresentação';
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.addEventListener('click', function () {
      saveMode(!modeOn);
      applyIndexAppearance();
      if (!modeOn && modalOpen) closeModal();
    });

    var pad = actions.querySelector('.warm-pad-toggle');
    var holyrics = actions.querySelector('.holyrics-export');
    if (pad) {
      actions.insertBefore(toggleBtn, pad);
    } else if (holyrics && holyrics.nextSibling) {
      actions.insertBefore(toggleBtn, holyrics.nextSibling);
    } else if (holyrics) {
      actions.appendChild(toggleBtn);
    } else {
      actions.insertBefore(toggleBtn, actions.firstChild);
    }
  }

  function insertPrefs(actions) {
    prefsRow = document.createElement('div');
    prefsRow.className = 'presentation-prefs';
    prefsRow.id = 'presentation-prefs';
    prefsRow.hidden = true;

    bgBtn = document.createElement('button');
    bgBtn.type = 'button';
    bgBtn.className = 'presentation-prefs-btn';
    bgBtn.textContent = 'fundo';
    bgBtn.addEventListener('click', openBgPickerModal);

    scrollBtn = document.createElement('button');
    scrollBtn.type = 'button';
    scrollBtn.className = 'presentation-prefs-btn';
    scrollBtn.textContent = 'rolagem';
    scrollBtn.addEventListener('click', function () {
      saveView('scroll');
      updateViewButtons();
      if (modalOpen) renderPresentation();
    });

    slideBtn = document.createElement('button');
    slideBtn.type = 'button';
    slideBtn.className = 'presentation-prefs-btn';
    slideBtn.textContent = 'slide';
    slideBtn.addEventListener('click', function () {
      saveView('slide');
      updateViewButtons();
      if (modalOpen) renderPresentation();
    });

    var bgGroup = document.createElement('div');
    bgGroup.className = 'presentation-prefs-group';
    bgGroup.appendChild(bgBtn);

    var viewGroup = document.createElement('div');
    viewGroup.className = 'presentation-prefs-group';
    viewGroup.append(scrollBtn, slideBtn);

    prefsRow.append(bgGroup, viewGroup);
    if (actions.nextSibling) {
      actions.parentNode.insertBefore(prefsRow, actions.nextSibling);
    } else {
      actions.parentNode.appendChild(prefsRow);
    }
    createBgPickerModal();
  }

  function createBgPickerModal() {
    if (bgPickerModal) return;
    bgPickerModal = document.createElement('div');
    bgPickerModal.className = 'presentation-bg-picker-modal';
    bgPickerModal.id = 'presentation-bg-picker-modal';
    bgPickerModal.hidden = true;

    var dialog = document.createElement('section');
    dialog.className = 'presentation-bg-picker-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'presentation-bg-picker-title');

    var title = document.createElement('h2');
    title.id = 'presentation-bg-picker-title';
    title.textContent = 'Imagem de fundo';

    var hint = document.createElement('p');
    hint.className = 'presentation-bg-picker-hint';
    hint.textContent = 'Escolha uma imagem para o fundo da apresentação.';

    bgInput = document.createElement('input');
    bgInput.type = 'file';
    bgInput.accept = 'image/*';
    bgInput.className = 'presentation-bg-picker-input';
    bgInput.setAttribute('aria-label', 'Escolher imagem de fundo');
    bgInput.addEventListener('change', onBackgroundPicked);

    var actions = document.createElement('div');
    actions.className = 'presentation-bg-picker-actions';
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'presentation-bg-picker-clear';
    clearBtn.textContent = 'Sem fundo';
    clearBtn.addEventListener('click', clearBackground);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Fechar';
    closeBtn.addEventListener('click', closeBgPickerModal);
    actions.append(clearBtn, closeBtn);

    dialog.append(title, hint, bgInput, actions);
    bgPickerModal.appendChild(dialog);
    bgPickerModal.addEventListener('click', function (event) {
      if (event.target === bgPickerModal) closeBgPickerModal();
    });
    document.body.appendChild(bgPickerModal);
  }

  function openBgPickerModal() {
    if (!bgPickerModal) createBgPickerModal();
    bgPickerModal.hidden = false;
  }

  function closeBgPickerModal() {
    if (bgPickerModal) bgPickerModal.hidden = true;
  }

  function clearBackground() {
    if (bgInput) bgInput.value = '';
    saveBackground('');
    applyModalBackground();
    closeBgPickerModal();
  }

  function onBackgroundPicked() {
    var file = bgInput && bgInput.files && bgInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        saveBackground('');
        applyModalBackground();
        closeBgPickerModal();
        return;
      }
      saveBackground(dataUrl);
      applyModalBackground();
      closeBgPickerModal();
    };
    reader.onerror = function () {
      saveBackground('');
      applyModalBackground();
      showBgWarning();
      closeBgPickerModal();
    };
    reader.readAsDataURL(file);
  }

  function createModal() {
    modal = document.createElement('div');
    modal.className = 'presentation-modal';
    modal.id = 'presentation-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Apresentação');

    modalBg = document.createElement('div');
    modalBg.className = 'presentation-modal-bg';
    modalBg.setAttribute('aria-hidden', 'true');

    var escBtn = document.createElement('button');
    escBtn.type = 'button';
    escBtn.className = 'presentation-modal-esc';
    escBtn.textContent = 'ESC';
    escBtn.setAttribute('aria-label', 'Fechar apresentação');
    escBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      closeModal();
    });

    var fonts = document.createElement('div');
    fonts.className = 'presentation-modal-fonts';
    var minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.setAttribute('aria-label', 'Diminuir texto');
    minus.addEventListener('click', function (event) {
      event.stopPropagation();
      saveFont(fontPercent - FONT_STEP);
      renderPresentation();
    });
    var plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.setAttribute('aria-label', 'Aumentar texto');
    plus.addEventListener('click', function (event) {
      event.stopPropagation();
      saveFont(fontPercent + FONT_STEP);
      renderPresentation();
    });
    fonts.append(minus, plus);

    stage = document.createElement('div');
    stage.className = 'presentation-stage';
    stage.addEventListener('click', onStageClick);
    stage.addEventListener('touchstart', onStageTouchStart, { passive: true });
    stage.addEventListener('touchmove', onStageTouchMove, { passive: true });
    stage.addEventListener('touchend', onStageTouchEnd, { passive: true });

    digitHint = document.createElement('div');
    digitHint.className = 'presentation-digit-hint';
    digitHint.hidden = true;

    bgWarning = document.createElement('div');
    bgWarning.className = 'presentation-bg-warning';
    bgWarning.hidden = true;

    modal.append(modalBg, escBtn, fonts, stage, digitHint, bgWarning);
    document.body.appendChild(modal);
  }

  function onStageTouchStart(event) {
    touchMoved = false;
    var touch = event.touches && event.touches[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function onStageTouchMove(event) {
    var touch = event.touches && event.touches[0];
    if (!touch) return;
    if (
      Math.abs(touch.clientX - touchStartX) > 10 ||
      Math.abs(touch.clientY - touchStartY) > 10
    ) {
      touchMoved = true;
    }
  }

  function onStageTouchEnd() {
    // touchMoved é consumido no próximo click sintético
  }

  function onStageClick(event) {
    if (!modalOpen) return;
    if (touchMoved) {
      touchMoved = false;
      return;
    }
    if (event.target.closest && (
      event.target.closest('.presentation-modal-esc') ||
      event.target.closest('.presentation-modal-fonts')
    )) return;
    if (viewMode === 'scroll') {
      var block = event.target.closest && event.target.closest('.presentation-scroll-block');
      if (block && stage.contains(block)) {
        var clickedIndex = parseInt(block.getAttribute('data-index'), 10);
        if (isFinite(clickedIndex)) {
          goToIndex(clickedIndex);
          return;
        }
      }
    }
    var rect = modal.getBoundingClientRect();
    var mid = rect.left + rect.width / 2;
    if (event.clientX < mid) goRelative(-1);
    else goRelative(1);
  }

  function applyModalBackground() {
    if (!modalBg) return;
    if (bgDataUrl) {
      modalBg.style.backgroundImage = 'url("' + bgDataUrl.replace(/"/g, '\\"') + '")';
    } else {
      modalBg.style.backgroundImage = 'none';
    }
  }

  function normalizeTitle(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function titlesMatch(block, title) {
    var a = normalizeTitle(block).toLowerCase();
    var b = normalizeTitle(title).toLowerCase();
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.indexOf(b + ' —') === 0 || a.indexOf(b + ' -') === 0) return true;
    return false;
  }

  function filterStropheLines(lines) {
    var kept = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!String(line).trim()) continue;
      if (isChordLine(line)) continue;
      if (isBracketLine(line)) continue;
      kept.push(String(line).trim().replace(/ {2,}/g, ' '));
    }
    return kept;
  }

  function parsePresentableStrophes(rawText, title) {
    var text = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var lines = text.split('\n');
    var blocks = [];
    var current = [];

    function flush() {
      var filtered = filterStropheLines(current);
      current = [];
      if (filtered.length) blocks.push(filtered.join('\n'));
    }

    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') flush();
      else current.push(lines[i]);
    }
    flush();

    var cleanTitle = normalizeTitle(title);
    if (cleanTitle) {
      if (!blocks.length || !titlesMatch(blocks[0], cleanTitle)) {
        blocks.unshift(cleanTitle);
      }
    }
    return blocks;
  }

  function extractTitleFromDoc(doc, fallback) {
    var titleEl = doc.querySelector('.holyrics-title');
    if (titleEl && normalizeTitle(titleEl.textContent)) {
      return normalizeTitle(titleEl.textContent);
    }
    var pre = doc.querySelector('body > pre') || doc.querySelector('pre');
    if (pre) {
      var preLines = String(pre.textContent || '').split(/\r?\n/);
      var first = '';
      for (var i = 0; i < preLines.length; i++) {
        if (normalizeTitle(preLines[i])) {
          first = preLines[i];
          break;
        }
      }
      if (first) {
        var cut = first.split(/\s+[—–-]\s+/);
        if (cut[0] && normalizeTitle(cut[0])) return normalizeTitle(cut[0]);
        return normalizeTitle(first);
      }
    }
    return normalizeTitle(fallback);
  }

  function isSongLink(anchor) {
    if (!anchor || anchor.tagName !== 'A') return false;
    if (anchor.classList.contains('capo-btn')) return false;
    var href = anchor.getAttribute('href') || '';
    var path = href.split('#')[0].split('?')[0];
    if (!/\.html?$/i.test(path)) return false;
    if (/index\.html?$/i.test(path)) return false;
    if (/^https?:\/\//i.test(path) && path.indexOf(window.location.origin) !== 0) return false;
    return true;
  }

  function resolveSongUrl(anchor) {
    return new URL(anchor.getAttribute('href'), window.location.href).href;
  }

  function fitElement(el) {
    if (!el) return;
    var size = preferredFontPx();
    el.style.fontSize = size + 'px';
    var guard = 60;
    while (
      guard-- > 0 &&
      size > 14 &&
      (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
    ) {
      size -= 2;
      el.style.fontSize = size + 'px';
    }
  }

  function fitScrollBlock(block) {
    if (!block || !stage) return;
    var size = preferredFontPx();
    block.style.fontSize = size + 'px';
    var usable = Math.max(120, stage.clientHeight - 36);
    var guard = 60;
    while (guard-- > 0 && size > 14 && block.scrollHeight > usable) {
      size -= 2;
      block.style.fontSize = size + 'px';
    }
  }

  function getScrollBlocks() {
    if (!stage) return [];
    return stage.querySelectorAll('.presentation-scroll-block');
  }

  function focusScrollStrophe(smooth) {
    var blocks = getScrollBlocks();
    if (!blocks.length) return;
    var target = null;
    for (var i = 0; i < blocks.length; i++) {
      var isCurrent = parseInt(blocks[i].getAttribute('data-index'), 10) === currentIndex;
      blocks[i].classList.toggle('is-current', isCurrent);
      if (isCurrent) target = blocks[i];
    }
    if (!target) return;
    fitScrollBlock(target);
    window.requestAnimationFrame(function () {
      target.scrollIntoView({
        block: 'center',
        behavior: smooth ? 'smooth' : 'auto'
      });
    });
  }

  function renderPresentation() {
    if (!stage) return;
    stage.classList.toggle('is-scroll', viewMode === 'scroll');
    stage.replaceChildren();

    if (!strophes.length) {
      var empty = document.createElement('p');
      empty.className = 'presentation-empty';
      empty.textContent = EMPTY_MESSAGE;
      stage.appendChild(empty);
      return;
    }

    currentIndex = Math.max(0, Math.min(currentIndex, strophes.length - 1));

    if (viewMode === 'scroll') {
      var flow = document.createElement('div');
      flow.className = 'presentation-scroll-flow';
      for (var i = 0; i < strophes.length; i++) {
        var block = document.createElement('div');
        block.className = 'presentation-scroll-block';
        block.dataset.index = String(i);
        block.textContent = strophes[i];
        block.style.fontSize = preferredFontPx() + 'px';
        flow.appendChild(block);
      }
      stage.appendChild(flow);
      focusScrollStrophe(false);
      return;
    }

    var slide = document.createElement('div');
    slide.className = 'presentation-slide';
    slide.textContent = strophes[currentIndex];
    stage.appendChild(slide);
    window.requestAnimationFrame(function () { fitElement(slide); });
  }

  function updateDigitHint() {
    if (!digitHint) return;
    if (!digitBuffer) {
      digitHint.hidden = true;
      digitHint.textContent = '';
      return;
    }
    digitHint.hidden = false;
    digitHint.textContent = digitBuffer;
  }

  function navigateToIndex(index, smoothScroll) {
    if (!strophes.length) return;
    var next = Math.max(0, Math.min(index, strophes.length - 1));
    if (next === currentIndex) return;
    if (viewMode === 'scroll') {
      currentIndex = next;
      focusScrollStrophe(!!smoothScroll);
      return;
    }
    currentIndex = next;
    renderPresentation();
  }

  function goToIndex(index) {
    navigateToIndex(index, viewMode === 'scroll');
  }

  function goRelative(delta) {
    if (!strophes.length) return;
    var next = currentIndex + delta;
    if (next < 0 || next >= strophes.length) return;
    navigateToIndex(next, viewMode === 'scroll');
  }

  function confirmDigitJump() {
    if (!digitBuffer) return;
    var n = parseInt(digitBuffer, 10);
    digitBuffer = '';
    updateDigitHint();
    if (!isFinite(n) || n < 1) return;
    if (!strophes.length) return;
    if (n > strophes.length) goToIndex(strophes.length - 1);
    else goToIndex(n - 1);
  }

  function requestFullscreenBestEffort() {
    if (!modal || !modal.requestFullscreen) return;
    var result = modal.requestFullscreen();
    if (result && typeof result.catch === 'function') {
      result.catch(function () { /* fallback viewport */ });
    }
  }

  function exitFullscreenBestEffort() {
    if (!document.fullscreenElement) return;
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(function () { /* ignore */ });
    }
  }

  function openModal() {
    if (!modal) createModal();
    applyModalBackground();
    modal.hidden = false;
    modalOpen = true;
    document.body.style.overflow = 'hidden';
    digitBuffer = '';
    updateDigitHint();
    renderPresentation();
    requestFullscreenBestEffort();
  }

  function closeModal() {
    if (!modalOpen) return;
    modalOpen = false;
    digitBuffer = '';
    updateDigitHint();
    exitFullscreenBestEffort();
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    strophes = [];
    currentIndex = 0;
  }

  function openFromAnchor(anchor) {
    if (!modeOn || loading) return;
    var url = resolveSongUrl(anchor);
    var fallbackTitle = normalizeTitle(anchor.textContent);
    loading = true;
    fetch(url, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('fetch failed');
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var pre = doc.querySelector('body > pre') || doc.querySelector('pre');
        var raw = pre ? (pre.textContent || '') : '';
        var title = extractTitleFromDoc(doc, fallbackTitle);
        strophes = parsePresentableStrophes(raw, title);
        currentIndex = 0;
        openModal();
      })
      .catch(function () {
        strophes = [];
        currentIndex = 0;
        openModal();
      })
      .then(function () {
        loading = false;
      });
  }

  function onContentClick(event) {
    if (!modeOn) return;
    if (event.defaultPrevented) return;
    if (event.button != null && event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var anchor = event.target.closest && event.target.closest('a[href]');
    var content = document.getElementById('content');
    if (!anchor || !content || !content.contains(anchor)) return;
    if (!isSongLink(anchor)) return;
    event.preventDefault();
    openFromAnchor(anchor);
  }

  function onKeyDown(event) {
    if (!modalOpen) return;
    var key = event.key;

    if (key === 'Escape') {
      event.preventDefault();
      digitBuffer = '';
      updateDigitHint();
      closeModal();
      return;
    }

    if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') {
      event.preventDefault();
      digitBuffer = '';
      updateDigitHint();
      goRelative(-1);
      return;
    }

    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === ' ') {
      event.preventDefault();
      digitBuffer = '';
      updateDigitHint();
      goRelative(1);
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      confirmDigitJump();
      return;
    }

    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      if (digitBuffer.length >= 2) digitBuffer = '';
      digitBuffer += key;
      updateDigitHint();
      return;
    }

    if (key === 'Backspace' && digitBuffer) {
      event.preventDefault();
      digitBuffer = digitBuffer.slice(0, -1);
      updateDigitHint();
    }
  }

  function onFullscreenChange() {
    // O navegador consome o primeiro Esc só para sair do fullscreen;
    // fechar a apresentação no mesmo gesto.
    if (!modalOpen) return;
    if (!document.fullscreenElement) closeModal();
  }

  function init() {
    loadCss();
    loadPreferences();
    var actions = ensureActions();
    insertToggle(actions);
    insertPrefs(actions);
    createModal();
    applyIndexAppearance();
    applyModalBackground();

    var content = document.getElementById('content');
    if (content) content.addEventListener('click', onContentClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
