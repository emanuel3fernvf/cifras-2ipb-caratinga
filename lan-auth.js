(function () {
  'use strict';

  if (window.__chordEditorLanAuthInstalled) return;
  window.__chordEditorLanAuthInstalled = true;

  var nativeFetch = window.fetch.bind(window);
  var apiPrefix = '/__chord_editor__/';
  var lanMode = false;

  async function requestJson(path, options) {
    var response = await nativeFetch(apiPrefix + path, Object.assign({
      cache: 'no-store',
      credentials: 'same-origin'
    }, options || {}));
    var payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('O servidor devolveu uma resposta inválida (HTTP ' + response.status + ').');
    }
    if (!response.ok) {
      var serverError = payload.error;
      throw new Error(
        serverError && serverError.message
          ? serverError.message
          : 'Erro HTTP ' + response.status
      );
    }
    return payload;
  }

  window.ChordEditorLanAuth = {
    isLanMode: function () { return lanMode; },
    getSession: function () { return requestJson('auth/session'); },
    login: function (password) {
      return requestJson('auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password })
      });
    },
    logout: function () {
      return requestJson('auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
    }
  };

  window.fetch = async function (input, init) {
    var response = await nativeFetch(input, init);
    var requestUrl = new URL(
      input instanceof Request ? input.url : input,
      window.location.href
    );
    if (requestUrl.pathname === apiPrefix + 'health' && response.ok) {
      try {
        var health = await response.clone().json();
        lanMode = health.mode === 'lan';
      } catch (error) {
        lanMode = false;
      }
    }
    return response;
  };
})();
