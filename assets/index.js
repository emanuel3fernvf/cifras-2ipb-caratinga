(function () {
  'use strict';

  var scriptUrl = document.currentScript && document.currentScript.src;
  if (!scriptUrl) {
    console.error('Não foi possível localizar o carregador dos recursos compartilhados.');
    return;
  }

  var folder = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).slice(-2, -1)[0] || '');
  var variants = {
    '17-e-18-de-outubro': 1,
    '2026_03_15_DOM': 2,
    '2026_04_19': 2,
    '2026_05_31': 3,
    '2026_06_21': 3,
    '2026_06_27': 3,
    '2026_07_05_DOM': 4,
    '2026_07_11_UMP': 4,
    '2026_07_12_DOM': 5,
    '2026_08_02': 6,
    '2026_08_16': 7,
    '2026_08_30': 1,
    '2026_09_06': 1,
    '2026_09_12': 1,
    '2026_09_20': 8,
    '2026_10_04': 1,
    '2026_10_29': 1,
    '2026_11_01': 1,
    'musical_pascoa_UMP_2026': 2,
    'nivel-1': 1,
    'pergunte-aos-animais-musical': 9
  };
  var variant = variants[folder] || 1;
  var isIndex = /\/index\.html?$/i.test(window.location.pathname);

  if (isIndex && (variant === 2 || variant === 3 || variant === 4)) {
    variant = 1;
  }

  function loadScript(path, onload) {
    var child = document.createElement('script');
    child.src = new URL(path + '?v=20261117-13', scriptUrl).href;
    if (onload) child.addEventListener('load', onload, { once: true });
    child.addEventListener('error', function () {
      console.error('Não foi possível carregar o recurso compartilhado: ' + path);
    }, { once: true });
    document.head.appendChild(child);
  }

  loadScript('index-variant-' + variant + '.js', function () {
    loadScript('pad.js', function () {
      if (isIndex) loadScript('presentation-mode.js');
      else loadScript('reading-controls.js');
    });
  });
}());
