// Filters (status, scope) and expand/collapse. State lives in the URL hash,
// e.g. #status=failed&scope=fresh, so a filtered view can be linked.
(function () {
  var runs = Array.prototype.slice.call(document.querySelectorAll('tr.run'));
  var cases = Array.prototype.slice.call(document.querySelectorAll('tbody.case'));
  var files = Array.prototype.slice.call(document.querySelectorAll('details.file'));
  var statusButtons = Array.prototype.slice.call(document.querySelectorAll('[data-status]'));
  var scopeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-scope]'));
  var empty = document.querySelector('.empty[hidden]');

  function readState() {
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    var status = params.get('status');
    var scope = params.get('scope');
    return {
      status: status === 'passed' || status === 'failed' ? status : 'all',
      scope: scope === 'fresh' && scopeButtons.length ? 'fresh' : 'all',
    };
  }

  function matchesStatus(row, status) {
    return status === 'all' || (status === 'passed') === (row.dataset.pass === '1');
  }
  function matchesScope(row, scope) {
    return scope === 'all' || row.dataset.fresh === '1';
  }

  function apply() {
    var state = readState();
    var shown = 0;
    runs.forEach(function (row) {
      var visible = matchesStatus(row, state.status) && matchesScope(row, state.scope);
      row.hidden = !visible;
      if (visible) shown++;
    });
    cases.forEach(function (body) { body.hidden = !body.querySelector('tr.run:not([hidden])'); });
    files.forEach(function (file) { file.hidden = !file.querySelector('tbody.case:not([hidden])'); });
    if (empty) empty.hidden = shown > 0;

    statusButtons.forEach(function (button) {
      var value = button.dataset.status;
      button.setAttribute('aria-pressed', String(value === state.status));
      button.querySelector('.count').textContent = runs.filter(function (row) {
        return matchesStatus(row, value) && matchesScope(row, state.scope);
      }).length;
    });
    scopeButtons.forEach(function (button) {
      var value = button.dataset.scope;
      button.setAttribute('aria-pressed', String(value === state.scope));
      button.querySelector('.count').textContent = runs.filter(function (row) {
        return matchesScope(row, value) && matchesStatus(row, state.status);
      }).length;
    });
  }

  function setState(key, value) {
    var state = readState();
    state[key] = value;
    var parts = [];
    if (state.status !== 'all') parts.push('status=' + state.status);
    if (state.scope !== 'all') parts.push('scope=' + state.scope);
    history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname + location.search);
    apply();
  }

  statusButtons.forEach(function (b) { b.addEventListener('click', function () { setState('status', b.dataset.status); }); });
  scopeButtons.forEach(function (b) { b.addEventListener('click', function () { setState('scope', b.dataset.scope); }); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-expand]'), function (b) {
    b.addEventListener('click', function () {
      var open = b.dataset.expand === '1';
      files.forEach(function (file) { file.open = open; });
    });
  });
  window.addEventListener('hashchange', apply);
  apply();
})();
