(function () {
  'use strict';

  var minFontSizePercent = 75;
  var maxFontSizePercent = 200;
  var fontSizeStep = 5;
  var fontSizeStorageKey = 'catalog-shared-font-size';
  var legacyFontSizeStorageKey = 'pergunte-aos-animais-musical-font-size';
  var fontSizePercent = 100;
  var activeStropheIndex = -1;

  function getNavigableStrophes() {
    return Array.prototype.filter.call(
      document.querySelectorAll('body > pre .strophe'),
      function (strophe) {
        var lines = strophe.querySelectorAll('.line');
        if (lines.length !== 1) return true;
        return !/\[[^\]]*\]/.test(lines[0].textContent || '');
      }
    );
  }

  function updateStropheNavigationHighlight() {
    var allStrophes = document.querySelectorAll('body > pre .strophe');
    var strophes = getNavigableStrophes();
    if (activeStropheIndex >= strophes.length) {
      activeStropheIndex = strophes.length - 1;
    }
    if (!strophes.length) activeStropheIndex = -1;

    for (var i = 0; i < allStrophes.length; i++) {
      allStrophes[i].classList.remove('is-keyboard-selected');
    }
    if (activeStropheIndex !== -1) {
      strophes[activeStropheIndex].classList.add('is-keyboard-selected');
    }
  }

  function isInteractiveNavigationTarget(target) {
    if (!target || !target.closest) return false;

    return !!target.closest(
      'input, textarea, select, button, a[href], summary, iframe, audio[controls], video[controls], ' +
      '[contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], ' +
      '[role="dialog"], [aria-modal="true"], [tabindex]:not([tabindex="-1"]), ' +
      '.editor-modal-backdrop, .holyrics-review-modal:not([hidden])'
    );
  }

  function stopAutoScroll() {
    var toggle = document.querySelector('.auto-scroll-panel button');
    if (toggle && toggle.textContent.trim() === 'Parar') {
      toggle.click();
    }
  }

  function handleStropheNavigationKeyDown(event) {
    if (event.defaultPrevented) return;
    if (isInteractiveNavigationTarget(event.target) ||
        isInteractiveNavigationTarget(document.activeElement) ||
        document.querySelector('[aria-modal="true"]:not([hidden]), .editor-modal-backdrop:not([hidden])')) {
      return;
    }

    if (event.key === 'Escape') {
      if (activeStropheIndex === -1) return;
      event.preventDefault();
      activeStropheIndex = -1;
      updateStropheNavigationHighlight();
      window.scrollTo(window.scrollX, window.scrollY);
      return;
    }

    if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp') ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    var strophes = getNavigableStrophes();
    if (!strophes.length) return;

    event.preventDefault();
    if (activeStropheIndex === -1) {
      stopAutoScroll();
      activeStropheIndex = event.key === 'ArrowDown' ? 0 : strophes.length - 1;
    } else {
      var direction = event.key === 'ArrowDown' ? 1 : -1;
      activeStropheIndex = Math.max(0, Math.min(strophes.length - 1, activeStropheIndex + direction));
    }

    updateStropheNavigationHighlight();
    strophes[activeStropheIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function loadFontSizePreference() {
    try {
      var stored = window.localStorage.getItem(fontSizeStorageKey);
      if (stored == null) stored = window.localStorage.getItem(legacyFontSizeStorageKey);
      var value = stored == null ? 100 : Number(stored);
      if (!Number.isFinite(value) || value < minFontSizePercent || value > maxFontSizePercent) {
        return 100;
      }
      return value;
    } catch (error) {
      console.error('Não foi possível carregar o tamanho do texto salvo.', error);
      return 100;
    }
  }

  function applyFontSizeToPres() {
    var pres = document.querySelectorAll('body > pre');
    for (var i = 0; i < pres.length; i++) {
      var pre = pres[i];
      var baseFontSize = parseFloat(pre.getAttribute('data-base-font-size'));
      if (!Number.isFinite(baseFontSize)) {
        baseFontSize = parseFloat(window.getComputedStyle(pre).fontSize);
        if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) {
          console.error('Não foi possível determinar o tamanho padrão do texto da cifra.');
          continue;
        }
        pre.setAttribute('data-base-font-size', String(baseFontSize));
      }
      pre.style.fontSize = (baseFontSize * fontSizePercent / 100) + 'px';
    }
  }

  function updateFontSizeControls() {
    var displays = document.querySelectorAll('.font-size-display');
    var decreaseButtons = document.querySelectorAll('.font-size-decrease');
    var increaseButtons = document.querySelectorAll('.font-size-increase');
    var resetButtons = document.querySelectorAll('.font-size-reset');

    for (var i = 0; i < displays.length; i++) {
      displays[i].textContent = fontSizePercent + '%';
    }
    for (var j = 0; j < decreaseButtons.length; j++) {
      decreaseButtons[j].disabled = fontSizePercent <= minFontSizePercent;
    }
    for (var k = 0; k < increaseButtons.length; k++) {
      increaseButtons[k].disabled = fontSizePercent >= maxFontSizePercent;
    }
    for (var n = 0; n < resetButtons.length; n++) {
      resetButtons[n].disabled = fontSizePercent === 100;
    }
  }

  function setFontSizePercent(value) {
    fontSizePercent = Math.max(minFontSizePercent, Math.min(maxFontSizePercent, value));
    applyFontSizeToPres();
    updateFontSizeControls();
    try {
      window.localStorage.setItem(fontSizeStorageKey, String(fontSizePercent));
    } catch (error) {
      console.error('Não foi possível salvar o tamanho do texto da cifra.', error);
    }
  }

  function createFontSizeControls(parent) {
    if (parent.querySelector('.font-size-controls')) return;

    var row = document.createElement('div');
    row.className = 'tone-toolbar-row font-size-controls';

    var label = document.createElement('span');
    label.textContent = 'Texto:';

    var decrease = document.createElement('button');
    decrease.type = 'button';
    decrease.className = 'video-sticky-toggle font-size-decrease';
    decrease.textContent = '−';
    decrease.disabled = fontSizePercent <= minFontSizePercent;
    decrease.setAttribute('aria-label', 'Diminuir tamanho do texto');
    decrease.addEventListener('click', function () {
      setFontSizePercent(fontSizePercent - fontSizeStep);
    });

    var display = document.createElement('span');
    display.className = 'font-size-display';
    display.textContent = fontSizePercent + '%';
    display.setAttribute('aria-live', 'polite');
    display.setAttribute('aria-label', 'Tamanho do texto');

    var increase = document.createElement('button');
    increase.type = 'button';
    increase.className = 'video-sticky-toggle font-size-increase';
    increase.textContent = '+';
    increase.disabled = fontSizePercent >= maxFontSizePercent;
    increase.setAttribute('aria-label', 'Aumentar tamanho do texto');
    increase.addEventListener('click', function () {
      setFontSizePercent(fontSizePercent + fontSizeStep);
    });

    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'video-sticky-toggle font-size-reset';
    reset.textContent = '100%';
    reset.disabled = fontSizePercent === 100;
    reset.title = 'Restaurar tamanho padrão';
    reset.setAttribute('aria-label', 'Restaurar tamanho padrão do texto (100%)');
    reset.addEventListener('click', function () {
      setFontSizePercent(100);
    });

    row.appendChild(label);
    row.appendChild(decrease);
    row.appendChild(display);
    row.appendChild(increase);
    row.appendChild(reset);
    parent.appendChild(row);
  }

  function findToolbar() {
    return document.querySelector('.top-tone-controls') || document.querySelector('.tone-toolbar');
  }

  function observeStropheRendering() {
    if (!window.MutationObserver) return;
    var pres = document.querySelectorAll('body > pre');
    for (var i = 0; i < pres.length; i++) {
      var observer = new window.MutationObserver(updateStropheNavigationHighlight);
      observer.observe(pres[i], { childList: true, subtree: true });
    }
  }

  function init() {
    if (!document.querySelector('body > pre .strophe')) return;

    fontSizePercent = loadFontSizePreference();
    applyFontSizeToPres();
    updateStropheNavigationHighlight();
    observeStropheRendering();
    document.addEventListener('keydown', handleStropheNavigationKeyDown);

    var toolbar = findToolbar();
    if (!toolbar) {
      console.error('Não foi possível localizar a barra de tom para os controles de fonte.');
      return;
    }
    createFontSizeControls(toolbar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
