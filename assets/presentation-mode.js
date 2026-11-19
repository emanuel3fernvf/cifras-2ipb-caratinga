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
  var STORAGE_CLEAN_TOKENS_PREFIX = 'catalog-presentation-clean-tokens:';

  var MIN_FONT = 75;
  var MAX_FONT = 200;
  var FONT_STEP = 5;
  var BASE_FONT_PX = 42;
  var EMPTY_MESSAGE = 'Sem letra apresentável';

  var DEFAULT_REVIEW_TITLE = 'Revisar palavras da exportação';
  var DEFAULT_REVIEW_DESCRIPTION = 'Escolha quais palavras devem ser exportadas sem traços ou underlines.';
  var DEFAULT_REVIEW_CONFIRM = 'Baixar';
  var CLEAN_REVIEW_TITLE = 'Revisar palavras para limpar';
  var CLEAN_REVIEW_DESCRIPTION = 'Escolha quais palavras devem aparecer sem traços ou underlines nas apresentações.';
  var CLEAN_REVIEW_CONFIRM = 'Salvar';

  var modeOn = false;
  var viewMode = 'slide';
  var bgDataUrl = '';
  var fontPercent = 100;
  var strophes = [];
  var currentIndex = 0;
  var digitBuffer = '';
  var modalOpen = false;
  var loading = false;
  var cleanReviewState = null;
  var cleanLoading = false;

  var toggleBtn;
  var prefsRow;
  var bgBtn;
  var bgInput;
  var bgPickerModal;
  var scrollBtn;
  var slideBtn;
  var cleanWrap;
  var cleanBtn;
  var cleanMenu;
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

  function stripInvisibleChars(line) {
    return String(line || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
  }

  function isBlankLine(line) {
    return stripInvisibleChars(line).trim() === '';
  }

  function isChordLine(line) {
    var trimmed = stripInvisibleChars(line).trim();
    if (!trimmed) return false;
    var withoutChords = trimmed.replace(CHORD_REGEX, '');
    var withoutSpaces = withoutChords.replace(/\s/g, '');
    if (!withoutSpaces) return true;
    if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(withoutSpaces)) return false;
    return true;
  }

  function isBracketLine(line) {
    return /[\[\]]/.test(stripInvisibleChars(line));
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

  function getIndexFolder() {
    var parts = (window.location.pathname || '').split('/').filter(Boolean);
    if (!parts.length) return '';
    var last = parts[parts.length - 1];
    if (/index\.html?$/i.test(last)) {
      return decodeURIComponent(parts[parts.length - 2] || '');
    }
    return decodeURIComponent(last);
  }

  function getCleanTokensStorageKey() {
    return STORAGE_CLEAN_TOKENS_PREFIX + (getIndexFolder() || 'evento');
  }

  function loadCleanTokenCorrections() {
    var raw = readStorage(getCleanTokensStorageKey(), '');
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      var out = {};
      Object.keys(parsed).forEach(function (key) {
        if (typeof parsed[key] === 'string') out[key] = parsed[key];
      });
      return out;
    } catch (err) {
      return {};
    }
  }

  function saveCleanTokenCorrections(corrections) {
    var key = getCleanTokensStorageKey();
    var map = corrections && typeof corrections === 'object' ? corrections : {};
    var keys = Object.keys(map);
    if (!keys.length) {
      try { window.localStorage.removeItem(key); } catch (err) { /* ignore */ }
      return true;
    }
    return writeStorage(key, JSON.stringify(map));
  }

  function getPresentationLyricLines(rawText) {
    var lines = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var start = -1;
    for (var i = 0; i < lines.length; i++) {
      if (isChordLine(lines[i])) {
        start = i;
        break;
      }
    }
    if (start === -1) return [];
    return lines.slice(start).filter(function (line) {
      return !isBracketLine(line) && !isChordLine(line);
    });
  }

  function collectPresentationCleanItems(songs, savedCorrections) {
    var saved = savedCorrections && typeof savedCorrections === 'object' ? savedCorrections : {};
    var seen = {};
    var items = [];
    (songs || []).forEach(function (song) {
      getPresentationLyricLines(song && song.preText).forEach(function (line) {
        String(line || '').replace(/\S+/g, function (token) {
          if ((token.indexOf('-') !== -1 || token.indexOf('_') !== -1) && !seen[token]) {
            seen[token] = true;
            items.push({
              source: token,
              corrected: token.replace(/[-_]/g, ''),
              useCorrected: Object.prototype.hasOwnProperty.call(saved, token)
            });
          }
          return token;
        });
      });
    });
    return items;
  }

  function applyPresentationTokenChoices(line, corrections) {
    return String(line || '').replace(/\S+/g, function (token) {
      return corrections && Object.prototype.hasOwnProperty.call(corrections, token)
        ? corrections[token]
        : token;
    });
  }

  function applyPresentationCleanTokensToRaw(rawText, corrections) {
    if (!corrections || !Object.keys(corrections).length) return String(rawText || '');
    var lines = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    return lines.map(function (line) {
      if (isBlankLine(line) || isChordLine(line) || isBracketLine(line)) return line;
      return applyPresentationTokenChoices(line, corrections);
    }).join('\n');
  }

  function insertCleanControl(group) {
    if (!group || document.getElementById('presentation-clean')) return;

    cleanWrap = document.createElement('div');
    cleanWrap.className = 'presentation-clean';
    cleanWrap.id = 'presentation-clean';

    cleanBtn = document.createElement('button');
    cleanBtn.type = 'button';
    cleanBtn.className = 'presentation-prefs-btn presentation-clean-btn';
    cleanBtn.id = 'presentation-clean-btn';
    cleanBtn.textContent = 'Limpar';
    cleanBtn.title = 'Limpar traços e underlines nas apresentações';
    cleanBtn.setAttribute('aria-label', 'Limpar traços e underlines nas apresentações');
    cleanBtn.setAttribute('aria-haspopup', 'true');
    cleanBtn.setAttribute('aria-expanded', 'false');

    cleanMenu = document.createElement('div');
    cleanMenu.className = 'presentation-clean-menu';
    cleanMenu.id = 'presentation-clean-menu';
    cleanMenu.hidden = true;

    var option = document.createElement('button');
    option.type = 'button';
    option.className = 'presentation-clean-option';
    option.setAttribute('data-action', 'clean-tokens');
    option.textContent = 'Limpar traços e underlines';
    cleanMenu.appendChild(option);

    cleanWrap.appendChild(cleanBtn);
    cleanWrap.appendChild(cleanMenu);
    group.appendChild(cleanWrap);

    cleanBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !!cleanMenu.hidden;
      cleanMenu.hidden = !open;
      cleanBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    cleanMenu.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    option.addEventListener('click', function () {
      cleanMenu.hidden = true;
      cleanBtn.setAttribute('aria-expanded', 'false');
      startCleanTokensReview(option);
    });

    document.addEventListener('click', function () {
      if (!cleanMenu) return;
      cleanMenu.hidden = true;
      if (cleanBtn) cleanBtn.setAttribute('aria-expanded', 'false');
    });
  }

  function setCleanReviewOpen(open) {
    var reviewModal = document.getElementById('holyrics-review-modal');
    if (!reviewModal) return;
    reviewModal.hidden = !open;
    document.body.classList.toggle('holyrics-review-open', open);
  }

  function restoreCleanReviewTexts() {
    var title = document.getElementById('holyrics-review-title');
    var description = document.getElementById('holyrics-review-description');
    var confirm = document.getElementById('holyrics-review-confirm');
    if (title) title.textContent = DEFAULT_REVIEW_TITLE;
    if (description) description.textContent = DEFAULT_REVIEW_DESCRIPTION;
    if (confirm) confirm.textContent = DEFAULT_REVIEW_CONFIRM;
  }

  function closeCleanReview() {
    var opener = cleanReviewState && cleanReviewState.opener;
    cleanReviewState = null;
    restoreCleanReviewTexts();
    setCleanReviewOpen(false);
    if (opener && typeof opener.focus === 'function') opener.focus();
  }

  function renderCleanReview(items) {
    var list = document.getElementById('holyrics-review-list');
    if (!list) return;
    list.textContent = '';
    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'holyrics-review-empty';
      empty.textContent = 'Nenhuma palavra com traço ou underline foi encontrada.';
      list.appendChild(empty);
      return;
    }
    items.forEach(function (item, index) {
      var card = document.createElement('fieldset');
      card.className = 'holyrics-review-card';
      var legend = document.createElement('legend');
      legend.textContent = 'Palavra ' + (index + 1);
      card.appendChild(legend);
      [{ value: 'original', text: item.source }, { value: 'corrected', text: item.corrected }].forEach(function (choice) {
        var label = document.createElement('label');
        label.className = 'holyrics-review-choice';
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'presentation-clean-review-' + index;
        radio.value = choice.value;
        radio.checked = choice.value === (item.useCorrected ? 'corrected' : 'original');
        radio.addEventListener('change', function () {
          item.useCorrected = this.value === 'corrected';
        });
        var text = document.createElement('span');
        text.textContent = choice.text;
        label.appendChild(radio);
        label.appendChild(text);
        card.appendChild(label);
      });
      list.appendChild(card);
    });
  }

  function openCleanReview(songs, opener) {
    var saved = loadCleanTokenCorrections();
    var items = collectPresentationCleanItems(songs, saved);
    cleanReviewState = { songs: songs, reviewItems: items, opener: opener };
    var title = document.getElementById('holyrics-review-title');
    var description = document.getElementById('holyrics-review-description');
    var confirm = document.getElementById('holyrics-review-confirm');
    if (title) title.textContent = CLEAN_REVIEW_TITLE;
    if (description) description.textContent = CLEAN_REVIEW_DESCRIPTION;
    if (confirm) confirm.textContent = CLEAN_REVIEW_CONFIRM;
    renderCleanReview(items);
    setCleanReviewOpen(true);
    if (title) title.focus();
  }

  function confirmCleanReview() {
    if (!cleanReviewState) return;
    var corrections = {};
    cleanReviewState.reviewItems.forEach(function (item) {
      if (item.useCorrected) corrections[item.source] = item.corrected;
    });
    saveCleanTokenCorrections(corrections);
    closeCleanReview();
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

  function parseSongPreText(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var pre = doc.querySelector('body > pre') || doc.querySelector('pre');
    return { preText: pre ? (pre.textContent || '') : '' };
  }

  function startCleanTokensReview(opener) {
    if (cleanLoading || cleanReviewState) return;
    var urls = getSongLinksFromIndex();
    if (!urls.length) {
      window.alert('Nenhuma cifra encontrada no índice.');
      return;
    }
    if (window.location.protocol === 'file:') {
      window.alert('Abra o índice via servidor HTTP local (ex.: python -m http.server) para limpar.');
      return;
    }

    cleanLoading = true;
    Promise.all(urls.map(function (url) {
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error('Falha ao carregar ' + url);
        return res.text();
      });
    })).then(function (htmls) {
      var songs = htmls.map(parseSongPreText);
      openCleanReview(songs, opener);
    }).catch(function (err) {
      console.error(err);
      window.alert('Erro ao limpar: ' + (err && err.message ? err.message : String(err)));
    }).then(function () {
      cleanLoading = false;
    });
  }

  function bindCleanReviewModal() {
    var reviewModal = document.getElementById('holyrics-review-modal');
    var cancel = document.getElementById('holyrics-review-cancel');
    var confirm = document.getElementById('holyrics-review-confirm');
    if (cancel) {
      cancel.addEventListener('click', function () {
        if (!cleanReviewState) return;
        closeCleanReview();
      });
    }
    if (confirm) {
      confirm.addEventListener('click', function () {
        if (!cleanReviewState) return;
        confirmCleanReview();
      });
    }
    if (reviewModal) {
      reviewModal.addEventListener('keydown', function (event) {
        if (!cleanReviewState) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCleanReview();
        }
      });
    }
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
    insertCleanControl(bgGroup);

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

  function cleanVerseLine(line) {
    return stripInvisibleChars(line)
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .replace(/ {2,}/g, ' ');
  }

  function filterStropheLines(lines) {
    var kept = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (isBlankLine(line)) continue;
      if (isChordLine(line)) continue;
      if (isBracketLine(line)) continue;
      var cleaned = cleanVerseLine(line);
      if (!cleaned) continue;
      kept.push(cleaned);
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
      // Linha só com ZWSP/espaço conta como separador de estrofe
      if (isBlankLine(lines[i])) flush();
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
    // Evita HTML antigo em cache depois de editar/separar estrofes na cifra.
    var fetchUrl = new URL(url);
    fetchUrl.searchParams.set('_presentation', String(Date.now()));
    fetch(fetchUrl.href, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('fetch failed');
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var pre = doc.querySelector('body > pre') || doc.querySelector('pre');
        var raw = pre ? (pre.textContent || '') : '';
        var title = extractTitleFromDoc(doc, fallbackTitle);
        var cleanedRaw = applyPresentationCleanTokensToRaw(raw, loadCleanTokenCorrections());
        strophes = parsePresentableStrophes(cleanedRaw, title);
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
    bindCleanReviewModal();
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
