(function () {
  'use strict';

  var notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var intervals = [0, 2, 4, 5, 7, 9, 11];
  var audio = null;
  var playingNote = null;
  var scale = 'C';
  var customNotes = [];
  var toggle;
  var panel;
  var grid;
  var custom;
  var scaleSelect;

  function visibleNotes() {
    var root = notes.indexOf(scale);
    if (scale === 'custom') return customNotes.slice();
    return intervals.map(function (interval) {
      return notes[(root + interval) % notes.length];
    });
  }

  function saveScaleToUrl() {
    var url = new URL(window.location.href);
    if (scale === 'custom') {
      url.searchParams.set('escala', 'custom');
      if (customNotes.length) url.searchParams.set('notas', customNotes.join(','));
      else url.searchParams.delete('notas');
    } else if (scale === 'C') {
      url.searchParams.delete('escala');
      url.searchParams.delete('notas');
    } else {
      url.searchParams.set('escala', scale);
      url.searchParams.delete('notas');
    }
    window.history.replaceState(null, '', url.toString());
  }

  function stopAudio() {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio = null;
    }
    playingNote = null;
    if (grid) {
      grid.querySelectorAll('.warm-pad-btn.active').forEach(function (button) {
        button.classList.remove('active');
      });
    }
  }

  function playNote(note) {
    if (playingNote === note) {
      stopAudio();
      return;
    }
    stopAudio();
    var index = notes.indexOf(note) + 1;
    var number = index < 10 ? '0' + index : String(index);
    var filename = number + ' - WARM PAD - ' + note.replace(/#/g, '%23') + '.mp3';
    audio = new Audio(new URL('../Warm Pads/' + filename, window.location.href).href);
    audio.loop = true;
    playingNote = note;
    audio.play().catch(function (error) {
      console.error('Warm Pad:', note, error);
    });
    var button = grid && grid.querySelector('[data-note="' + note + '"]');
    if (button) button.classList.add('active');
  }

  function renderGrid() {
    if (!grid) return;
    grid.replaceChildren();
    visibleNotes().forEach(function (note) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'warm-pad-btn';
      button.dataset.note = note;
      button.setAttribute('aria-label', 'Tocar pad em ' + note);
      if (note === playingNote) button.classList.add('active');
      var label = document.createElement('span');
      label.className = 'pad-label';
      label.textContent = note;
      button.appendChild(label);
      button.addEventListener('click', function () {
        playNote(note);
      });
      grid.appendChild(button);
    });
  }

  function renderCustomNotes() {
    custom.replaceChildren();
    notes.forEach(function (note) {
      var label = document.createElement('label');
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = note;
      checkbox.checked = customNotes.indexOf(note) !== -1;
      checkbox.addEventListener('change', function () {
        customNotes = customNotes.filter(function (item) { return item !== note; });
        if (checkbox.checked) customNotes.push(note);
        customNotes.sort(function (a, b) { return notes.indexOf(a) - notes.indexOf(b); });
        saveScaleToUrl();
        renderGrid();
      });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(note));
      custom.appendChild(label);
    });
  }

  function updatePanelPosition() {
    if (!toggle || !panel || !panel.classList.contains('visible')) return;
    var rect = toggle.getBoundingClientRect();
    panel.style.top = Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - panel.offsetHeight - 8)) + 'px';
    panel.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
    panel.style.left = 'auto';
  }

  function dockToggle() {
    var target = document.querySelector('.tone-toolbar-row') ||
      document.querySelector('.toolbar-extra-row') ||
      document.querySelector('.top-tone-controls') ||
      document.querySelector('.index-actions');
    if (!target) {
      var toneButton = document.querySelector('.video-sticky-toggle');
      if (toneButton && toneButton.parentElement !== document.body) {
        target = toneButton.parentElement;
        target.classList.add('tone-toolbar-row');
      }
    }
    if (!target) {
      var toneButtons = Array.prototype.slice.call(
        document.querySelectorAll('body > .video-sticky-toggle')
      );
      if (toneButtons.length) {
        target = document.createElement('div');
        target.className = 'tone-toolbar-row pad-actions';
        toneButtons[0].parentNode.insertBefore(target, toneButtons[0]);
        toneButtons.forEach(function (button) {
          target.appendChild(button);
        });
      }
    }
    if (!target && toggle && document.querySelector('pre')) {
      target = document.createElement('div');
      target.className = 'tone-toolbar-row pad-actions';
      document.body.insertBefore(target, document.querySelector('pre'));
    }
    if (!target) target = document.querySelector('.holyrics-export');
    if (target && toggle && toggle.parentElement !== target) {
      if (target.classList.contains('holyrics-export')) target = target.parentElement;
      if (target) target.appendChild(toggle);
    }
  }

  function createPlayer() {
    var params = new URLSearchParams(window.location.search);
    var initialScale = params.get('escala');
    if (initialScale === 'custom' || initialScale === 'personalizado') {
      scale = 'custom';
      customNotes = (params.get('notas') || '').split(',').filter(function (note) {
        return notes.indexOf(note) !== -1;
      });
    } else if (notes.indexOf(initialScale) !== -1) {
      scale = initialScale;
    }

    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'warm-pad-toggle';
    toggle.textContent = 'Mostrar Pad';

    panel = document.createElement('div');
    panel.className = 'warm-pad-panel';
    panel.id = 'warm-pad-panel';

    var controls = document.createElement('div');
    controls.className = 'warm-pad-controls';
    var label = document.createElement('label');
    label.textContent = 'Escala:';
    label.htmlFor = 'warm-pad-scale';
    scaleSelect = document.createElement('select');
    scaleSelect.id = 'warm-pad-scale';
    notes.forEach(function (note) {
      var option = document.createElement('option');
      option.value = note;
      option.textContent = note + ' maior';
      scaleSelect.appendChild(option);
    });
    var customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Personalizado';
    scaleSelect.appendChild(customOption);
    scaleSelect.value = scale;
    scaleSelect.addEventListener('change', function () {
      scale = scaleSelect.value;
      if (scale !== 'custom') customNotes = [];
      saveScaleToUrl();
      renderCustomNotes();
      custom.classList.toggle('visible', scale === 'custom');
      renderGrid();
    });
    controls.appendChild(label);
    controls.appendChild(scaleSelect);
    custom = document.createElement('div');
    custom.className = 'warm-pad-custom';
    grid = document.createElement('div');
    grid.className = 'warm-pad-grid';
    panel.append(controls, custom, grid);

    toggle.setAttribute('aria-controls', panel.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('visible');
      toggle.textContent = open ? 'Ocultar Pad' : 'Mostrar Pad';
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        var exportMenu = document.getElementById('holyrics-export-menu');
        if (exportMenu) exportMenu.hidden = true;
        updatePanelPosition();
      }
    });
    document.body.append(toggle, panel);
    renderCustomNotes();
    custom.classList.toggle('visible', scale === 'custom');
    renderGrid();
    dockToggle();
  }

  function init() {
    toggle = document.querySelector('.warm-pad-toggle');
    panel = document.querySelector('.warm-pad-panel');
    if (!toggle || !panel) {
      createPlayer();
    } else {
      dockToggle();
      if (!panel.id) panel.id = 'warm-pad-panel';
      toggle.setAttribute('aria-controls', panel.id);
      toggle.setAttribute('aria-expanded', String(panel.classList.contains('visible')));
      toggle.addEventListener('click', function () {
        var open = panel.classList.contains('visible');
        toggle.setAttribute('aria-expanded', String(open));
        if (open) {
          var exportMenu = document.getElementById('holyrics-export-menu');
          if (exportMenu) exportMenu.hidden = true;
          updatePanelPosition();
        }
      });
      var exportButton = document.getElementById('holyrics-export-btn');
      if (exportButton) {
        exportButton.addEventListener('click', function () {
          if (panel) panel.classList.remove('visible');
          if (toggle) {
            toggle.textContent = 'Mostrar Pad';
            toggle.setAttribute('aria-expanded', 'false');
          }
        });
      }
    }
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
