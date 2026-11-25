// Filters, review ticks, expand/collapse and the theme switch.
// Filters live in the URL hash (#status=failed&scope=changed&review=todo), so a
// filtered view can be linked. Review ticks and the theme live in this
// browser's localStorage: they are each reviewer's own and outlast the report.
(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const runs = all('tr.run');

  const storage = {
    read(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Private windows and blocked storage: ticks last until the page closes.
      }
    },
  };

  // ---- Review ticks: { "<file>::<case>#<round>": "<fingerprint>" } ----
  const reviewKey = document.body.dataset.reviewStore;
  const reviewed = storage.read(reviewKey, {});
  const isReviewed = (run) => reviewed[run.dataset.key] === run.dataset.fingerprint;
  const changedSince = (run) => run.dataset.key in reviewed && !isReviewed(run);

  function markReviewed(rows, on) {
    for (const run of rows) {
      if (on) reviewed[run.dataset.key] = run.dataset.fingerprint;
      else delete reviewed[run.dataset.key];
    }
    storage.write(reviewKey, reviewed);
    apply();
  }

  // ---- Filters ----
  const filters = { status: 'all', scope: 'all', review: 'all' };
  const matchers = {
    status: (run, value) => value === 'all' || (value === 'passed') === (run.dataset.passed === 'true'),
    scope: (run, value) => value === 'all' || run.closest('tbody.case').dataset.fresh === 'true',
    review: (run, value) => value === 'all' || (value === 'done') === isReviewed(run),
  };
  const matchesOthers = (run, skipped) => Object.keys(filters).every((name) => name === skipped || matchers[name](run, filters[name]));

  function readHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    for (const name of Object.keys(filters)) {
      const value = params.get(name);
      filters[name] = document.querySelector(`button[data-filter="${name}"][data-value="${value}"]`) ? value : 'all';
    }
  }

  function writeHash() {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== 'all'));
    const hash = params.toString();
    try {
      history.replaceState(null, '', hash ? `#${hash}` : location.href.split('#')[0]);
    } catch {
      // Some hosts refuse URL changes: the filter still applies, it just can't be linked.
    }
  }

  function setGroupBox(box, rows) {
    const done = rows.filter(isReviewed).length;
    box.checked = rows.length > 0 && done === rows.length;
    box.indeterminate = done > 0 && done < rows.length;
  }

  function apply() {
    for (const run of runs) {
      run.hidden = !matchesOthers(run, null);
      run.classList.toggle('is-reviewed', isReviewed(run));
      run.querySelector('[data-review-run]').checked = isReviewed(run);
      run.querySelector('.changed-since').hidden = !changedSince(run);
    }
    for (const evalCase of all('tbody.case')) {
      evalCase.hidden = !evalCase.querySelector('tr.run:not([hidden])');
      setGroupBox(evalCase.querySelector('[data-review-case]'), all('tr.run', evalCase));
    }
    for (const file of all('details.file')) {
      const rows = all('tr.run', file);
      file.hidden = !file.querySelector('tbody.case:not([hidden])');
      setGroupBox(file.querySelector('[data-review-file]'), rows);
      file.querySelector('[data-file-reviewed]').textContent = rows.filter(isReviewed).length;
    }
    const countFor = (filter, value) => runs.filter((run) => matchesOthers(run, filter) && matchers[filter](run, value)).length;
    for (const button of all('button[data-filter]')) {
      const { filter, value } = button.dataset;
      button.setAttribute('aria-pressed', String(filters[filter] === value));
      button.querySelector('.count').textContent = countFor(filter, value);
    }
    for (const select of all('select[data-filter-select]')) {
      const filter = select.dataset.filterSelect;
      for (const option of select.options) option.textContent = `${option.dataset.label} ${countFor(filter, option.value)}`;
      select.value = filters[filter];
      select.classList.toggle('active', filters[filter] !== 'all');
    }
    const done = runs.filter(isReviewed).length;
    document.querySelector('[data-reviewed-count]').textContent = done;
    document.querySelector('[data-reviewed-bar]').style.width = `${runs.length ? (100 * done) / runs.length : 0}%`;
    const noMatch = document.querySelector('.no-match');
    if (noMatch) noMatch.hidden = runs.length === 0 || runs.some((run) => !run.hidden);
  }

  // ---- Column headers stick just below the filter bar, whatever its height ----
  const toolbar = document.querySelector('.toolbar');
  new ResizeObserver(() => document.documentElement.style.setProperty('--toolbar-height', `${toolbar.offsetHeight}px`)).observe(toolbar);

  // ---- Theme: the system's → light → dark ----
  const themes = ['system', 'light', 'dark'];
  const currentTheme = () => document.documentElement.dataset.theme ?? 'system';
  function showTheme() {
    const label = `Colour theme: ${currentTheme()}`;
    for (const button of all('[data-theme-switch]')) {
      button.title = `${label} (click to change)`;
      button.setAttribute('aria-label', label);
    }
  }

  // ---- Events ----
  document.addEventListener('click', (event) => {
    const filterButton = event.target.closest('button[data-filter]');
    if (filterButton) {
      filters[filterButton.dataset.filter] = filterButton.dataset.value;
      apply();
      writeHash();
    }
    const fold = event.target.closest('[data-passed-fold]');
    if (fold) fold.closest('td.checks').classList.toggle('show-passed');
    // On phones a reviewed run folds to its status line; tapping the line opens it.
    const runLabel = event.target.closest('.run-label');
    if (runLabel && !event.target.closest('label')) runLabel.closest('tr.run').classList.toggle('open');
    const expandButton = event.target.closest('button[data-expand]');
    if (expandButton) for (const file of all('details.file')) file.open = expandButton.dataset.expand === 'true';
    if (event.target.closest('[data-theme-switch]')) {
      const next = themes[(themes.indexOf(currentTheme()) + 1) % themes.length];
      if (next === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = next;
      storage.write('eval-report-theme', next);
      showTheme();
    }
  });
  document.addEventListener('change', (event) => {
    const box = event.target;
    if (box.matches('select[data-filter-select]')) {
      filters[box.dataset.filterSelect] = box.value;
      apply();
      writeHash();
      return;
    }
    if (box.matches('[data-review-run]')) markReviewed([box.closest('tr.run')], box.checked);
    else if (box.matches('[data-review-case]')) markReviewed(all('tr.run', box.closest('tbody.case')), box.checked);
    else if (box.matches('[data-review-file]')) markReviewed(all('tr.run', box.closest('details.file')), box.checked);
  });
  window.addEventListener('hashchange', () => {
    readHash();
    apply();
  });

  readHash();
  apply();
  showTheme();
  // A file you have reviewed completely starts folded.
  for (const file of all('details.file')) {
    const rows = all('tr.run', file);
    if (rows.length && rows.every(isReviewed)) file.open = false;
  }
})();
