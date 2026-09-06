/* Integração compartilhada pelos eventos; nenhum salvamento ocorre aqui. */
window.mountCifraClubImport = function (editor, textarea) {
  if (!editor.overlay.isConnected) return;
  var panel = document.createElement('div');
  panel.className = 'editor-cifraclub-import';
  panel.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center';
  var url = document.createElement('input');
  url.type = 'url'; url.placeholder = 'Link do Cifra Club';
  url.setAttribute('aria-label', 'Link do Cifra Club');
  url.className = 'editor-modal-input'; url.style.cssText = 'flex:1;min-width:180px';
  function button(label) {
    var el = document.createElement('button'); el.type = 'button';
    el.className = 'editor-find-button'; el.textContent = label; return el;
  }
  var run = button('Importar por imagem');
  var undo = button('Desfazer importação'); undo.hidden = true;
  var preview = document.createElement('details'); preview.hidden = true;
  preview.style.cssText = 'width:100%';
  var summary = document.createElement('summary'); summary.textContent = 'Conferir print';
  var image = document.createElement('img'); image.alt = 'Print usado para extrair a cifra';
  image.style.cssText = 'display:block;max-width:100%;max-height:240px;object-fit:contain;object-position:left top';
  var download = document.createElement('a'); download.textContent = 'Baixar print'; download.download = 'cifra.png';
  preview.append(summary, download, image);
  var status = document.createElement('span'); status.setAttribute('role', 'status');
  status.style.cssText = 'width:100%;font-size:13px';
  panel.append(url, run, undo, status, preview);
  var search = editor.header.querySelector('.editor-find-replace');
  editor.header.insertBefore(panel, search);
  textarea.wrap = 'off';
  var previous = null, importing = false;
  function notifyInput() { textarea.dispatchEvent(new Event('input', {bubbles:true})); }
  undo.addEventListener('click', function () {
    if (importing || previous === null) return;
    textarea.value = previous; previous = null; undo.hidden = true;
    preview.hidden = true; image.removeAttribute('src'); download.removeAttribute('href');
    status.textContent = 'Conteúdo anterior restaurado.'; notifyInput();
  });
  run.addEventListener('click', function () {
    if (importing || editor.pending) return;
    if (!url.value.trim() || !url.checkValidity()) {
      status.textContent = 'Informe um link HTTPS do Cifra Club.'; url.focus(); return;
    }
    importing = true;
    var original = textarea.value;
    var controls = Array.from(editor.overlay.querySelectorAll('input, textarea, select, button'))
      .filter(function (el) { return el !== editor.closeButton && el !== editor.cancelButton; });
    var states = controls.map(function (el) { return el.disabled; });
    controls.forEach(function (el) { el.disabled = true; });
    status.textContent = 'Capturando a cifra e extraindo o texto da imagem…';
    fetch('/__chord_editor__/import-cifraclub', {
      method:'POST', credentials:'same-origin', cache:'no-store',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:url.value.trim()})
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.error && data.error.message || 'Falha na importação.');
        if (typeof data.preText !== 'string' || !data.preText ||
            typeof data.image !== 'string' || !data.image.startsWith('data:image/png;base64,')) {
          throw new Error('O extrator devolveu um resultado incompleto.');
        }
        return data;
      });
    }).then(function (data) {
      if (!editor.overlay.isConnected) return;
      previous = original; textarea.value = data.preText;
      textarea.scrollTop = 0; textarea.scrollLeft = 0;
      undo.hidden = false; preview.hidden = false;
      image.src = data.image; download.href = data.image;
      status.textContent = [data.message].concat(data.warnings || []).filter(Boolean).join(' ');
    }).catch(function (error) {
      if (editor.overlay.isConnected) status.textContent = error.message || 'Falha na importação.';
    }).finally(function () {
      importing = false;
      if (!editor.overlay.isConnected) return;
      controls.forEach(function (el, index) { el.disabled = states[index]; });
      notifyInput();
    });
  });
};
