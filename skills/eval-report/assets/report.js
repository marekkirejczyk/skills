// Filters, review ticks, expand/collapse and the theme switch.
// Filter state lives in the URL hash (#status=failed&scope=fresh&review=todo),
// so a filtered view can be linked. Review ticks and the theme live in this
// browser's localStorage, so they are per person and survive new reports.
(function () {
  var all = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var files = all('details.file');
  var cases = all('tbody.case');
  var rounds = all('tr.run');
  var empty = document.querySelector('.empty[hidden]');
  var hasScope = all('[data-scope]').length > 0;

  // ---- Review ticks: { "<case id>#<round>": "<fingerprint>" } ----
  var storeKey = document.body.dataset.reviewStore || 'eval-report-reviewed';
  var reviewed = {};
  try { reviewed = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch (e) { reviewed = {}; }
  function save() { try { localStorage.setItem(storeKey, JSON.stringify(reviewed)); } catch (e) {} }
  function isReviewed(row) { return reviewed[row.dataset.key] === row.dataset.fingerprint; }
  function setReviewed(row, on) {
    if (on) reviewed[row.dataset.key] = row.dataset.fingerprint;
    else delete reviewed[row.dataset.key];
  }

  // ---- Filters ----
  function readState() {
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    var status = params.get('status');
    var review = params.get('review');
    return {
      status: status === 'passed' || status === 'failed' ? status : 'all',
      scope: params.get('scope') === 'fresh' && hasScope ? 'fresh' : 'all',
      review: review === 'todo' || review === 'done' ? review : 'all',
    };
  }
  // Status and scope are about the whole case: one failed round makes it a failed case.
  function caseMatches(body, state) {
    var statusOk = state.status === 'all' || (state.status === 'passed') === (body.dataset.pass === '1');
    var scopeOk = state.scope === 'all' || body.dataset.fresh === '1';
    return statusOk && scopeOk;
  }
  // Review is about each round.
  function roundMatches(row, review) {
    return review === 'all' || (review === 'done') === isReviewed(row);
  }
  function visibleCases(state) {
    return cases.filter(function (body) {
      return caseMatches(body, state) && all('tr.run', body).some(function (row) { return roundMatches(row, state.review); });
    });
  }

  function apply() {
    var state = readState();
    var shown = visibleCases(state);
    cases.forEach(function (body) {
      var visible = shown.indexOf(body) >= 0;
      body.hidden = !visible;
      all('tr.run', body).forEach(function (row) { row.hidden = !visible || !roundMatches(row, state.review); });
    });
    files.forEach(function (file) { file.hidden = !file.querySelector('tbody.case:not([hidden])'); });
    if (empty) empty.hidden = shown.length > 0;

    [['status', ['all', 'passed', 'failed']], ['scope', ['all', 'fresh']], ['review', ['all', 'todo', 'done']]].forEach(function (group) {
      var key = group[0];
      group[1].forEach(function (value) {
        var button = document.querySelector('[data-' + (key === 'review' ? 'review-filter' : key) + '="' + value + '"]');
        if (!button) return;
        var other = Object.assign({}, state);
        other[key] = value;
        button.setAttribute('aria-pressed', String(state[key] === value));
        button.querySelector('.count').textContent = visibleCases(other).length;
      });
    });
    showReview();
  }

  function setState(key, value) {
    var state = readState();
    state[key] = value;
    var parts = [];
    if (state.status !== 'all') parts.push('status=' + state.status);
    if (state.scope !== 'all') parts.push('scope=' + state.scope);
    if (state.review !== 'all') parts.push('review=' + state.review);
    history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname + location.search);
    apply();
  }

  // ---- Review display: boxes, dimmed rows, counts ----
  function setGroupBox(box, rows) {
    var done = rows.filter(isReviewed).length;
    box.checked = done > 0 && done === rows.length;
    box.indeterminate = done > 0 && done < rows.length;
  }
  function showReview() {
    rounds.forEach(function (row) {
      var done = isReviewed(row);
      row.classList.toggle('is-reviewed', done);
      row.querySelector('[data-review]').checked = done;
      // Ticked in an earlier report, but this round has changed since.
      row.querySelector('.changed-since').hidden = done || !(row.dataset.key in reviewed);
    });
    cases.forEach(function (body) { setGroupBox(body.querySelector('[data-review-case]'), all('tr.run', body)); });
    files.forEach(function (file) {
      var rows = all('tr.run', file);
      setGroupBox(file.querySelector('[data-review-file]'), rows);
      file.querySelector('[data-file-reviewed]').textContent = rows.filter(isReviewed).length;
    });
    var count = rounds.filter(isReviewed).length;
    var countEl = document.querySelector('[data-reviewed-count]');
    if (countEl) countEl.textContent = count;
    var bar = document.querySelector('[data-reviewed-bar]');
    if (bar) bar.style.width = (rounds.length ? (100 * count) / rounds.length : 0) + '%';
  }

  function tick(rows, on) {
    rows.forEach(function (row) { setReviewed(row, on); });
    save();
    apply();
  }
  rounds.forEach(function (row) {
    row.querySelector('[data-review]').addEventListener('change', function (event) { tick([row], event.target.checked); });
  });
  cases.forEach(function (body) {
    body.querySelector('[data-review-case]').addEventListener('change', function (event) { tick(all('tr.run', body), event.target.checked); });
  });
  files.forEach(function (file) {
    var box = file.querySelector('[data-review-file]');
    // A click on the box must not also open or close the file.
    box.addEventListener('click', function (event) { event.stopPropagation(); });
    box.addEventListener('change', function (event) { tick(all('tr.run', file), event.target.checked); });
  });

  // ---- Wiring ----
  all('[data-status]').forEach(function (b) { b.addEventListener('click', function () { setState('status', b.dataset.status); }); });
  all('[data-scope]').forEach(function (b) { b.addEventListener('click', function () { setState('scope', b.dataset.scope); }); });
  all('[data-review-filter]').forEach(function (b) { b.addEventListener('click', function () { setState('review', b.dataset.reviewFilter); }); });
  all('[data-expand]').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.dataset.expand === '1';
      files.forEach(function (file) { file.open = open; });
    });
  });
  window.addEventListener('hashchange', apply);

  // A file you have fully reviewed starts collapsed.
  files.forEach(function (file) {
    var rows = all('tr.run', file);
    if (rows.length && rows.every(isReviewed)) file.open = false;
  });
  apply();

  // ---- Theme: Auto (the system's) → Light → Dark ----
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
    themeButton.innerHTML = ICONS[theme];
    themeButton.title = 'Colour theme: ' + LABELS[theme] + ' (click to change)';
    themeButton.setAttribute('aria-label', 'Colour theme: ' + LABELS[theme]);
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
})();
