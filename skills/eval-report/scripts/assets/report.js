// Filters runs by status and scope, keeping the choice in the URL hash
// (#status=failed&scope=changed) so a filtered view can be linked.
(() => {
  const filters = { status: 'all', scope: 'all' };
  const runs = [...document.querySelectorAll('tr.run')];

  const isFresh = (run) => run.closest('tbody.case').dataset.fresh === 'true';
  const matchesStatus = (run, status) => status === 'all' || (status === 'passed') === (run.dataset.passed === 'true');
  const matchesScope = (run, scope) => scope === 'all' || isFresh(run);

  function readHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    for (const name of Object.keys(filters)) {
      const value = params.get(name);
      const known = document.querySelector(`button[data-filter="${name}"][data-value="${value}"]`);
      filters[name] = known ? value : 'all';
    }
  }

  function writeHash() {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(filters)) if (value !== 'all') params.set(name, value);
    const hash = params.toString();
    history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
  }

  function apply() {
    for (const run of runs) run.hidden = !(matchesStatus(run, filters.status) && matchesScope(run, filters.scope));
    for (const evalCase of document.querySelectorAll('tbody.case')) evalCase.hidden = !evalCase.querySelector('tr.run:not([hidden])');
    for (const file of document.querySelectorAll('details.file')) file.hidden = !file.querySelector('tbody.case:not([hidden])');
    for (const button of document.querySelectorAll('button[data-filter]')) {
      const { filter, value } = button.dataset;
      button.setAttribute('aria-pressed', String(filters[filter] === value));
      const count = filter === 'status'
        ? runs.filter((run) => matchesScope(run, filters.scope) && matchesStatus(run, value)).length
        : runs.filter((run) => matchesStatus(run, filters.status) && matchesScope(run, value)).length;
      button.querySelector('.count').textContent = count;
    }
    const noMatch = document.querySelector('.no-match');
    if (noMatch) noMatch.hidden = runs.length === 0 || runs.some((run) => !run.hidden);
  }

  document.addEventListener('click', (event) => {
    const filterButton = event.target.closest('button[data-filter]');
    if (filterButton) {
      filters[filterButton.dataset.filter] = filterButton.dataset.value;
      writeHash();
      apply();
    }
    const expandButton = event.target.closest('button[data-expand]');
    if (expandButton) {
      for (const file of document.querySelectorAll('details.file')) file.open = expandButton.dataset.expand === 'true';
    }
  });
  window.addEventListener('hashchange', () => {
    readHash();
    apply();
  });
  readHash();
  apply();
})();
