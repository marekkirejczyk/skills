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
  // Theme: Auto (the system's) → Light → Dark, remembered in this browser.
  var themeButton = document.querySelector('[data-theme-switch]');
  var THEMES = ['auto', 'light', 'dark'];
  var LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' };
  var ICONS = {
    auto: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 1.5v13a6.5 6.5 0 0 0 0-13Z"/></svg>',
    light: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.657-8.157a.75.75 0 0 1 0 1.061l-1.061 1.06a.749.749 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.193 9.193a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8Zm13 0a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8Zm-8 5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13Zm3.536-1.464a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061ZM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.751.751 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Z"/></svg>',
    dark: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z"/></svg>',
  };
  function currentTheme() { return document.documentElement.dataset.theme || 'auto'; }
  function showTheme() {
    var theme = currentTheme();
    themeButton.innerHTML = ICONS[theme] + ' ' + LABELS[theme];
    themeButton.title = 'Theme: ' + LABELS[theme] + ' (click to change)';
  }
  if (themeButton) {
    showTheme();
    themeButton.addEventListener('click', function () {
      var next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
      if (next === 'auto') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = next;
      try { localStorage.setItem('eval-report-theme', next); } catch (e) {}
      showTheme();
    });
  }
  window.addEventListener('hashchange', apply);
  apply();
})();
