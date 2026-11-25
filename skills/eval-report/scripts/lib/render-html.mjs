// Renders the report model as one static HTML page. The page's style and
// filter script live in ../../assets and are inlined, so the file stands alone.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stats } from './load.mjs';

const assets = new URL('../../assets/', import.meta.url);
const css = () => readFileSync(fileURLToPath(new URL('report.css', assets)), 'utf8');
const js = () => readFileSync(fileURLToPath(new URL('report.js', assets)), 'utf8');

export function escape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const ICON = {
  passBig: '<svg class="icon" width="18" height="18" viewBox="0 0 16 16" role="img" aria-label="passed"><path fill="currentColor" d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0Z"/></svg>',
  failBig: '<svg class="icon" width="18" height="18" viewBox="0 0 16 16" role="img" aria-label="failed"><path fill="currentColor" d="M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.75.75 0 0 0-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 1 0 1.06 1.06L8 9.06l1.97 1.97a.75.75 0 1 0 1.06-1.06L9.06 8l1.97-1.97a.75.75 0 0 0-1.06-1.06L8 6.94Z"/></svg>',
  pass: '<svg class="icon" width="14" height="14" viewBox="0 0 16 16" role="img" aria-label="passed"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>',
  fail: '<svg class="icon" width="14" height="14" viewBox="0 0 16 16" role="img" aria-label="failed"><path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>',
  chevron: '<svg class="chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg>',
};

const passClass = (passed, total) => (passed === total ? 'is-pass' : 'is-fail');

export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

// Light Markdown for model text: paragraphs, "- " and "1. " lists, **bold**, `code`.
export function formatText(text) {
  const inline = (line) => escape(line)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const blocks = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) blocks.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
  const flushList = () => { if (list) blocks.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; };
  for (const line of String(text).split('\n')) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const item = bullet || numbered;
    if (item) {
      flushPara();
      const tag = bullet ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(item[1]);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList(); para.push(line);
    }
  }
  flushPara(); flushList();
  return blocks.join('');
}

function json(value) {
  return `<pre class="json">${escape(JSON.stringify(value, null, 2))}</pre>`;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

const isFlat = (object) => Object.values(object).every((v) => typeof v !== 'object' || v === null);

// Rows of data (an array of flat objects) read best as a table.
function renderData(value) {
  if (Array.isArray(value) && value.length && value.every((row) => isPlainObject(row) && isFlat(row))) {
    const columns = [...new Set(value.flatMap((row) => Object.keys(row)))];
    return `<table class="data"><thead><tr>${columns.map((c) => `<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${value
      .map((row) => `<tr>${columns.map((c) => `<td>${escape(row[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  if (isPlainObject(value) && isFlat(value)) {
    return Object.entries(value).map(([k, v]) => `<div class="data-field"><div class="who">${escape(k)}</div><pre class="json">${escape(v)}</pre></div>`).join('');
  }
  return json(value);
}

function renderValue(value) {
  if (value == null) return '<span class="muted">—</span>';
  if (typeof value === 'string') return formatText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return `<p>${escape(value)}</p>`;
  if (Array.isArray(value) && value.every((v) => typeof v !== 'object' || v === null)) {
    return `<ul>${value.map((v) => `<li>${escape(v)}</li>`).join('')}</ul>`;
  }
  if (Array.isArray(value) && value.length && value.every((row) => isPlainObject(row) && isFlat(row))) return renderData(value);
  if (isPlainObject(value) && isFlat(value)) {
    return `<dl class="kv">${Object.entries(value).map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl>`;
  }
  return json(value);
}

export function renderInput(input) {
  const messages = Array.isArray(input) ? input : isPlainObject(input) && Array.isArray(input.messages) ? input.messages : null;
  if (messages && messages.every((m) => isPlainObject(m) && 'content' in m)) {
    return messages.map((m) => `<div class="msg"><div class="who">${escape(m.role || m.who || '')}</div>${renderValue(m.content)}</div>`).join('');
  }
  return renderValue(input);
}

function renderCard(card) {
  const parts = [`<div class="card"><div class="card-kind">${escape(card.kind || card.type || 'Card')}${card.title ? ` <span class="card-title">${escape(card.title)}</span>` : ''}</div>`];
  if (card.body) parts.push(`<div>${formatText(card.body)}</div>`);
  if (Array.isArray(card.items) && card.items.length) {
    parts.push(`<ul>${card.items.map((item) => `<li>${isPlainObject(item) ? Object.entries(item).map(([k, v]) => `<b>${escape(k)}</b> ${escape(v)}`).join(' · ') : escape(item)}</li>`).join('')}</ul>`);
  }
  if (Array.isArray(card.chips) && card.chips.length) {
    parts.push(`<div class="chips">${card.chips.map((chip) => `<span class="chip">${escape(chip)}</span>`).join('')}</div>`);
  }
  if (Array.isArray(card.links) && card.links.length) {
    parts.push(`<div class="links">→ ${card.links.map((link) => escape(String(link).replace(/^https?:\/\/(www\.)?/, '').split('/')[0])).join(', ')}</div>`);
  }
  parts.push('</div>');
  return parts.join('');
}

export function renderOutput(output) {
  if (!isPlainObject(output) || !('text' in output || 'cards' in output || 'data' in output)) return renderValue(output);
  const parts = [];
  if (output.text && String(output.text).trim()) parts.push(formatText(output.text));
  else parts.push('<p class="muted"><i>(no words)</i></p>');
  for (const card of output.cards || []) parts.push(renderCard(card));
  if (output.data !== undefined) parts.push(renderData(output.data));
  return parts.join('');
}

function renderChecks(checks) {
  if (!checks.length) return '<span class="muted">No checks</span>';
  const groups = new Map();
  for (const check of checks) {
    if (!groups.has(check.kind)) groups.set(check.kind, []);
    groups.get(check.kind).push(check);
  }
  return [...groups].map(([kind, items]) => `<div class="check-group"><div class="label">${escape(kind)}</div>${items.map((check) => `
<div class="check ${check.pass ? 'is-pass' : 'is-fail'}">${check.pass ? ICON.pass : ICON.fail}<div><div>${escape(check.label)}</div>${check.reason ? `<div class="reason">${escape(check.reason)}</div>` : ''}</div></div>`).join('')}</div>`).join('');
}

export function summarizeResult(result) {
  if (result === undefined) return 'not called';
  if (result === null) return 'null';
  if (typeof result !== 'object') {
    const text = String(result);
    return text.length > 40 ? `${text.slice(0, 39)}…` : text;
  }
  const compact = JSON.stringify(result);
  return compact.length > 48 ? `${compact.slice(0, 47)}…` : compact;
}

function renderMocks(mocks) {
  if (!mocks.length) return '<span class="muted">No tools run</span>';
  const lines = mocks.map((mock) => `<div class="mock"><code class="tool">${escape(mock.tool)}</code> <span class="muted">→</span> ${escape(summarizeResult(mock.result))}${mock.fake ? `<div class="fake">fake: ${escape(mock.fake)}</div>` : ''}</div>`).join('');
  const raw = mocks.map((mock) => `${mock.tool}(${mock.args === undefined ? '' : JSON.stringify(mock.args, null, 2)})\n→ ${mock.result === undefined ? 'not called' : JSON.stringify(mock.result, null, 2)}`).join('\n\n');
  return `${lines}<details class="raw"><summary>Arguments and results</summary><pre class="json">${escape(raw)}</pre></details>`;
}

function renderRun(run, fresh) {
  return `<tr class="run" data-pass="${run.pass ? 1 : 0}" data-fresh="${fresh ? 1 : 0}">
<td><div class="run-label ${run.pass ? 'is-pass' : 'is-fail'}">Round ${escape(run.round)} · ${run.pass ? 'passed' : 'failed'}${run.durationMs != null ? ` · ${formatDuration(run.durationMs)}` : ''}</div>${renderInput(run.input)}</td>
<td class="output">${renderOutput(run.output)}</td>
<td class="checks">${renderChecks(run.checks)}</td>
<td>${renderMocks(run.mocks)}</td>
</tr>`;
}

function renderCase(evalCase) {
  const fresh = evalCase.fresh;
  const code = evalCase.codeUrl
    ? `<a class="code-link" href="${escape(evalCase.codeUrl)}" target="_blank" rel="noopener">${escape(evalCase.fileName)}${evalCase.line ? `:${evalCase.line}` : ''} ↗</a>`
    : `<span class="code-link muted">${escape(evalCase.fileName)}${evalCase.line ? `:${evalCase.line}` : ''}</span>`;
  return `<tbody class="case" id="${escape(evalCase.id)}" data-fresh="${fresh ? 1 : 0}">
<tr class="case-head"><td colspan="4">
<div class="case-title ${evalCase.pass ? 'is-pass' : 'is-fail'}">${evalCase.pass ? ICON.passBig : ICON.failBig}
<a class="case-name" href="#${escape(evalCase.id)}">${escape(evalCase.name)}</a>
<span class="badge ${passClass(evalCase.runsPassed, evalCase.runs.length)}">${evalCase.runsPassed} / ${evalCase.runs.length} rounds</span>
${fresh ? `<span class="tag">${fresh === 'new' ? 'New' : 'Changed'}</span>` : ''}
<span class="spacer"></span>${code}</div>
${evalCase.rule ? `<div class="note"><b>Rule:</b> ${escape(evalCase.rule)}</div>` : ''}
${evalCase.knownBug ? `<div class="note"><b>Known bug:</b> ${escape(evalCase.knownBug)}</div>` : ''}
</td></tr>
${evalCase.runs.map((run) => renderRun(run, fresh)).join('\n')}
</tbody>`;
}

function renderFile(file) {
  for (const evalCase of file.cases) evalCase.fileName = file.path.split('/').pop();
  return `<details class="file" open data-path="${escape(file.path)}">
<summary>${ICON.chevron}<code class="path">${escape(file.path)}</code>
<span class="badge ${passClass(file.runsPassed, file.runs)}" data-badge>${file.runsPassed} / ${file.runs}</span>
<span class="spacer"></span><span class="muted small">${file.cases.length} ${file.cases.length === 1 ? 'case' : 'cases'}</span></summary>
<div class="table-box"><table class="runs">
<colgroup><col class="c-in"><col class="c-out"><col class="c-chk"><col class="c-mock"></colgroup>
<thead><tr><th>Input</th><th>Output</th><th>Judges and checks</th><th>Mocks: tools run, what they gave</th></tr></thead>
${file.cases.map(renderCase).join('\n')}
</table></div>
</details>`;
}

function headerContext(meta) {
  const parts = [];
  if (meta.repo) parts.push(meta.repoUrl ? `<a href="${escape(meta.repoUrl)}">${escape(meta.repo)}</a>` : escape(meta.repo));
  if (meta.pr) {
    const label = `#${meta.pr.number}${meta.pr.title ? ` ${meta.pr.title}` : ''}`;
    parts.push(`PR ${meta.pr.url ? `<a href="${escape(meta.pr.url)}">${escape(label)}</a>` : escape(label)}`);
  }
  if (meta.sha) parts.push(`<code class="sha">${escape(String(meta.sha).slice(0, 7))}</code>`);
  return parts.join('<span class="sep">·</span>');
}

export function renderHtml(report, { scope = null } = {}) {
  const totals = stats(report);
  const meta = report.meta;
  const title = meta.title || 'Eval report';
  const pct = totals.runs ? (100 * totals.runsPassed) / totals.runs : 0;
  const runAt = meta.runAt ? new Date(meta.runAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : '';
  const facts = [runAt, `${report.files.length} files`, `${totals.cases} cases`, `${totals.runs} rounds`, formatDuration(totals.durationMs)]
    .filter(Boolean).join(' · ');
  const scopeLabel = scope === 'commit' ? 'this commit' : 'this PR';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<script>try { var t = localStorage.getItem('eval-report-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}</script>
<style>${css()}</style>
</head>
<body>
<header class="top"><div class="wrap top-row">
<div class="top-text">
<div class="context">${headerContext(meta)}</div>
<h1>${escape(title)}</h1>
<div class="muted small">${escape(facts)}</div>
</div>
<div class="tiles">
<div class="tile"><div class="label">Rounds passed</div>
<div class="big"><span class="${passClass(totals.runsPassed, totals.runs)}">${totals.runsPassed}</span><span class="of">/ ${totals.runs}</span></div>
<div class="bar"><div style="width:${pct.toFixed(1)}%"></div></div></div>
<div class="tile"><div class="label">Cases passed</div>
<div class="big"><span class="${passClass(totals.casesPassed, totals.cases)}">${totals.casesPassed}</span><span class="of">/ ${totals.cases}</span></div>
<div class="muted small">A case passes when every round passes</div></div>
${scope ? `<div class="tile"><div class="label">New or changed in ${escape(scopeLabel)}</div>
<div class="big"><span class="${passClass(totals.freshRunsPassed, totals.freshRuns)}">${totals.freshRunsPassed}</span><span class="of">/ ${totals.freshRuns}</span></div>
<div class="muted small">${totals.freshCases} ${totals.freshCases === 1 ? 'case' : 'cases'}</div></div>` : ''}
</div></div></header>
<nav class="filters"><div class="wrap filter-row">
<div class="seg-group"><span class="label">Status</span><div class="seg" role="group" aria-label="Status">
<button type="button" data-status="all">All <span class="count"></span></button><button type="button" data-status="passed">Passed <span class="count"></span></button><button type="button" data-status="failed">Failed <span class="count"></span></button>
</div></div>
${scope ? `<div class="seg-group"><span class="label">Scope</span><div class="seg" role="group" aria-label="Scope">
<button type="button" data-scope="all">All <span class="count"></span></button><button type="button" data-scope="fresh">New or changed <span class="count"></span></button>
</div></div>` : ''}
<span class="spacer"></span>
<button type="button" class="btn" data-expand="1">Expand all</button><button type="button" class="btn" data-expand="0">Collapse all</button>
<button type="button" class="btn theme" data-theme-switch aria-label="Colour theme">Auto</button>
</div></nav>
<main class="wrap">
<div class="empty" hidden>No rounds match these filters.</div>
${report.files.length ? report.files.map(renderFile).join('\n') : '<div class="empty">No eval results.</div>'}
</main>
<footer class="wrap muted small">Generated by eval-report · no model tokens used</footer>
<script>${js()}</script>
</body>
</html>
`;
}
