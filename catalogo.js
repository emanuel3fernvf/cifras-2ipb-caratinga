(function () {
  'use strict';
  var foldersEl = document.getElementById('folder-list');
  var groupsEl = document.getElementById('song-groups');
  var folderCountEl = document.getElementById('folder-count');
  var songCountEl = document.getElementById('song-count');

  function createLink(item, className) {
    var link = document.createElement('a');
    link.className = className;
    link.href = item.path.split('/').map(encodeURIComponent).join('/');
    link.textContent = item.title;
    return link;
  }

  fetch('catalogo.json', { cache: 'no-store' }).then(function (response) {
    if (!response.ok) throw new Error('Erro HTTP ' + response.status);
    return response.json();
  }).then(function (catalog) {
    var folders = catalog.folders || [];
    var songCount = 0;
    foldersEl.replaceChildren();
    groupsEl.replaceChildren();
    folders.forEach(function (folder) {
      foldersEl.appendChild(createLink({ title: folder.name + ' · ' + folder.directory, path: folder.index }, 'catalog-link'));
      var section = document.createElement('section');
      section.className = 'song-group';
      var heading = document.createElement('h3');
      heading.textContent = folder.name + ' · ' + folder.directory;
      section.appendChild(heading);
      var links = document.createElement('div');
      links.className = 'song-list';
      folder.songs.forEach(function (song) {
        links.appendChild(createLink(song, 'song-link'));
        songCount += 1;
      });
      section.appendChild(links);
      groupsEl.appendChild(section);
    });
    folderCountEl.textContent = String(folders.length);
    songCountEl.textContent = String(songCount);
  }).catch(function (error) {
    folderCountEl.textContent = '!';
    songCountEl.textContent = '!';
    foldersEl.innerHTML = '<p class="empty">Não foi possível carregar o catálogo.</p>';
    groupsEl.innerHTML = '<p class="empty">' + error.message + '</p>';
  });
}());
