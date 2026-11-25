// Filters, review ticks, expand/collapse, JSON folds, what a check means and the
// theme switch. Filters live in the URL hash (#status=failed&scope=changed&review=todo),
// so a filtered view can be linked. Review ticks, shut folds and the theme live in
// this browser's localStorage: they are each reviewer's own and outlast the report.
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

  // ---- JSON folds a reader shut: { "<file>::<case>#<round>|<where in the run>": true } ----
  // Where a fold sits is its column, then each message, card, pair and JSON key down
  // to it, never the words around it, so it is found again in the next report.
  const foldStore = `${reviewKey}:folds`;
  const shutFolds = storage.read(foldStore, {});
  const PLACED = ['td', '.message', '.card', 'li'];
  function foldKey(fold) {
    const parts = [];
    for (let node = fold; node && !node.matches('tr.run'); node = node.parentElement) {
      const placed = PLACED.find((selector) => node.matches(selector));
      if (node.matches('details.json-fold')) parts.push(node.dataset.key);
      else if (node.matches('dd')) parts.push(node.previousElementSibling.textContent);
      else if (placed) parts.push(`${placed}${[...node.parentElement.children].filter((sibling) => sibling.matches(placed)).indexOf(node)}`);
    }
    return `${fold.closest('tr.run').dataset.key}|${parts.reverse().join('/')}`;
  }

  // ---- What a check means: one bubble, under the check that was clicked ----
  const bubble = Object.assign(document.createElement('div'), { className: 'about-bubble', id: 'about-bubble', hidden: true });
  bubble.setAttribute('role', 'note');
  document.body.append(bubble);
  let aboutButton = null;

  function closeAbout() {
    if (!aboutButton) return;
    aboutButton.setAttribute('aria-expanded', 'false');
    aboutButton = null;
    bubble.hidden = true;
  }

  function openAbout(button) {
    closeAbout();
    const check = button.closest('.check');
    aboutButton = button;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-controls', bubble.id);
    bubble.textContent = check.dataset.about;
    bubble.hidden = false;
    const box = check.getBoundingClientRect();
    const width = Math.min(Math.max(box.width, 240), 420, window.innerWidth - 16);
    bubble.style.width = `${width}px`;
    bubble.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - width - 8))}px`;
    const below = box.bottom + 6;
    const fits = below + bubble.offsetHeight <= window.innerHeight - 8;
    bubble.style.top = `${fits ? below : Math.max(8, box.top - 6 - bubble.offsetHeight)}px`;
  }

  // ---- The list of files and cases beside the report, on a very wide screen ----
  const caseLinks = all('[data-case-link]');
  const caseHead = (link) => document.getElementById(link.hash.slice(1));
  const besideReport = window.matchMedia('(min-width: 1920px)');

  // The case being read: the last one whose heading has reached the top of the page.
  function markCurrentCase() {
    if (!besideReport.matches) return;
    const line = (document.querySelector('.toolbar')?.offsetHeight ?? 0) + 80;
    const onPage = caseLinks.filter((link) => !link.hidden && caseHead(link).getClientRects().length > 0);
    const current = onPage.filter((link) => caseHead(link).getBoundingClientRect().top <= line).at(-1) ?? onPage[0];
    for (const link of caseLinks) {
      if (link === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  function showCase(link) {
    const head = caseHead(link);
    head.closest('details.file').open = true;
    const covered = toolbar.offsetHeight + head.closest('table').querySelector('th').offsetHeight;
    window.scrollTo({ top: head.getBoundingClientRect().top + window.scrollY - covered });
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
    for (const link of caseLinks) {
      const evalCase = caseHead(link).closest('tbody.case');
      const rows = all('tr.run', evalCase);
      link.hidden = evalCase.hidden;
      link.querySelector('.case-list-tick').hidden = !rows.every(isReviewed);
    }
    for (const group of all('.case-list-file')) group.hidden = !group.querySelector('[data-case-link]:not([hidden])');
    markCurrentCase();
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
    const caseLink = event.target.closest('[data-case-link]');
    if (caseLink) {
      // Not the link's own jump: that would replace the filters kept in the URL hash.
      event.preventDefault();
      showCase(caseLink);
    }
    const about = event.target.closest('.about-button');
    if (about && about !== aboutButton) openAbout(about);
    else if (about || !event.target.closest('.about-bubble')) closeAbout();
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
  // The bubble sits where its check was: once the page moves, it goes.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !aboutButton) return;
    aboutButton.focus();
    closeAbout();
  });
  window.addEventListener('scroll', closeAbout, { capture: true, passive: true });
  window.addEventListener('resize', closeAbout);
  let marking = false;
  window.addEventListener('scroll', () => {
    if (marking) return;
    marking = true;
    requestAnimationFrame(() => {
      marking = false;
      markCurrentCase();
    });
  }, { passive: true });
  besideReport.addEventListener('change', markCurrentCase);
  // `toggle` doesn't bubble, so it is caught on its way down.
  document.addEventListener('toggle', (event) => {
    const fold = event.target;
    if (!(fold instanceof HTMLElement) || !fold.matches('details.json-fold')) return;
    const key = foldKey(fold);
    if (fold.open === !(key in shutFolds)) return;
    if (fold.open) delete shutFolds[key];
    else shutFolds[key] = true;
    storage.write(foldStore, shutFolds);
  }, true);
  window.addEventListener('hashchange', () => {
    readHash();
    apply();
  });

  readHash();
  apply();
  showTheme();
  // The click bubble takes over from the hover tooltip, which would show beside it.
  for (const check of all('.check.has-about')) {
    check.dataset.about = check.title;
    check.removeAttribute('title');
  }
  for (const fold of all('details.json-fold')) if (foldKey(fold) in shutFolds) fold.open = false;
  // A file you have reviewed completely starts folded.
  for (const file of all('details.file')) {
    const rows = all('tr.run', file);
    if (rows.length && rows.every(isReviewed)) file.open = false;
  }
})();
