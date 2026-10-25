(function () {
  'use strict';

  var nativeFetch = window.fetch.bind(window);
  var apiPrefix = '/__chord_editor__/';
  var lanMode = false;
  var password = null;

  function isWrite(method) {
    return method === 'POST' || method === 'PUT' || method === 'DELETE';
  }

  function encodePassword(value) {
    var bytes = new TextEncoder().encode(value);
    var binary = '';
    bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function requestUrl(input) {
    return new URL(input instanceof Request ? input.url : input, window.location.href);
  }

  async function sendAuthenticated(input, init, retried) {
    if (password === null) {
      password = window.prompt('Senha administrativa do servidor local:');
      if (password === null) throw new Error('Operação cancelada.');
    }
    var headers = new Headers(
      (init && init.headers) || (input instanceof Request ? input.headers : undefined)
    );
    headers.set('X-Editor-Password', encodePassword(password));
    var options = Object.assign({}, init || {}, { headers: headers });
    var response = await nativeFetch(input, options);
    if (response.status === 401 && !retried) {
      password = null;
      return sendAuthenticated(input, init, true);
    }
    return response;
  }

  window.fetch = async function (input, init) {
    var url = requestUrl(input);
    var method = ((init && init.method) || (input instanceof Request && input.method) || 'GET').toUpperCase();
    if (!url.pathname.startsWith(apiPrefix) || !isWrite(method)) {
      var response = await nativeFetch(input, init);
      if (url.pathname === apiPrefix + 'health' && response.ok) {
        try {
          var health = await response.clone().json();
          lanMode = health.mode === 'lan';
        } catch (error) {
          lanMode = false;
        }
      }
      return response;
    }
    if (!lanMode) {
      var initialResponse = await nativeFetch(input, init);
      if (initialResponse.status !== 401) return initialResponse;
      lanMode = true;
    }
    return sendAuthenticated(input, init, false);
  };
})();
