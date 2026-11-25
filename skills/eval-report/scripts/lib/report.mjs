// The report page: one static HTML file with its stylesheet and script inlined.

import { readFileSync } from 'node:fs';
import { html, trusted } from './html.mjs';
import { renderInput, renderOutput, summarizeValue } from './content.mjs';
import { countRuns } from './results.mjs';

const asset = (name) => readFileSync(new URL(`../assets/${name}`, import.meta.url), 'utf8');

const PASS_ICON = trusted('<svg class="icon pass" width="16" height="16" viewBox="0 0 16 16" role="img" aria-label="passed"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0Z"/></svg>');
const FAIL_ICON = trusted('<svg class="icon fail" width="16" height="16" viewBox="0 0 16 16" role="img" aria-label="failed"><path d="M2.34 13.66A8 8 0 1 1 13.66 2.34 8 8 0 0 1 2.34 13.66ZM6.03 4.97a.75.75 0 0 0-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 1 0 1.06 1.06L8 9.06l1.97 1.97a.75.75 0 1 0 1.06-1.06L9.06 8l1.97-1.97a.75.75 0 0 0-1.06-1.06L8 6.94Z"/></svg>');
const CHECK_PASS = trusted('<svg class="icon pass" width="14" height="14" viewBox="0 0 16 16" role="img" aria-label="passed"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>');
const CHECK_FAIL = trusted('<svg class="icon fail" width="14" height="14" viewBox="0 0 16 16" role="img" aria-label="failed"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>');

const tone = ({ passed, total }) => (passed === total ? 'pass' : 'fail');

export function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return '';
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function checkGroups(checks) {
  const groups = new Map();
  for (const check of checks) {
    if (!groups.has(check.kind)) groups.set(check.kind, []);
    groups.get(check.kind).push(check);
  }
  return [...groups].map(([kind, items]) => html`<div class="check-group">
    <div class="label">${capitalize(kind)}</div>
    ${items.map((check) => html`<div class="check ${check.passed ? 'pass' : 'fail'}">
      ${check.passed ? CHECK_PASS : CHECK_FAIL}
      <div><div>${check.name}</div>${check.reason ? html`<div class="why">${check.reason}</div>` : ''}</div>
    </div>`)}
  </div>`);
}

function mocksCell(mocks) {
  if (mocks.length === 0) return html`<span class="muted">No tools run</span>`;
  const details = mocks.map((mock) => ({ tool: mock.tool, args: mock.args, result: mock.result }));
  return html`${mocks.map((mock) => html`<div class="mock">
      <span class="mono strong">${mock.tool}</span> <span class="muted">→</span> ${mock.summary ?? summarizeValue(mock.result)}
      ${mock.fake ? html`<div class="fake">fake: ${mock.fake}</div>` : ''}
    </div>`)}
    <details class="raw"><summary>Arguments and results</summary><pre class="code">${JSON.stringify(details, null, 2)}</pre></details>`;
}

function runRow(run) {
  const status = run.passed ? 'passed' : 'failed';
  const label = [`Run ${run.round}`, status, formatDuration(run.durationMs)].filter(Boolean).join(' · ');
  return html`<tr class="run" data-passed="${run.passed}">
    <td><div class="run-label ${run.passed ? 'pass' : 'fail'}">${label}</div>${renderInput(run.input)}</td>
    <td class="output">${renderOutput(run.output, run.error)}</td>
    <td class="checks">${run.checks.length ? checkGroups(run.checks) : html`<span class="muted">No checks</span>`}</td>
    <td>${mocksCell(run.mocks)}</td>
  </tr>`;
}

function caseBody(evalCase, file, codeUrl) {
  const runs = countRuns(evalCase.runs);
  const where = evalCase.line ? `${file.path.split('/').pop()}:${evalCase.line}` : file.path.split('/').pop();
  const url = codeUrl(file.path, evalCase.line);
  return html`<tbody class="case" data-fresh="${Boolean(evalCase.change)}">
    <tr class="case-head"><td colspan="4">
      <div class="case-title">
        ${evalCase.passed ? PASS_ICON : FAIL_ICON}
        <span class="case-name">${evalCase.name}</span>
        <span class="badge ${tone(runs)}">${runs.passed} / ${runs.total} runs</span>
        ${evalCase.change ? html`<span class="tag">${capitalize(evalCase.change)}</span>` : ''}
        <span class="spacer"></span>
        ${url ? html`<a class="mono" href="${url}">${where} ↗</a>` : html`<span class="mono muted">${where}</span>`}
      </div>
      ${evalCase.rule ? html`<div class="case-note"><strong>Rule:</strong> ${evalCase.rule}</div>` : ''}
      ${evalCase.note ? html`<div class="case-note"><strong>Note:</strong> ${evalCase.note}</div>` : ''}
    </td></tr>
    ${evalCase.runs.map(runRow)}
  </tbody>`;
}

function fileSection(file, codeUrl) {
  const count = countRuns(file.cases.flatMap((evalCase) => evalCase.runs));
  return html`<details class="file" open>
    <summary>
      <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg>
      <span class="mono strong file-path">${file.path}</span>
      <span class="badge ${tone(count)}">${count.passed} / ${count.total}</span>
      <span class="spacer"></span>
      <span class="muted small">${file.cases.length} ${file.cases.length === 1 ? 'case' : 'cases'}</span>
    </summary>
    <div class="table-scroll"><table class="runs">
      <colgroup><col class="col-input"><col class="col-output"><col class="col-checks"><col class="col-mocks"></colgroup>
      <thead><tr><th>Input</th><th>Output</th><th>Judges and checks</th><th>Mocks: tools run, what they gave</th></tr></thead>
      ${file.cases.map((evalCase) => caseBody(evalCase, file, codeUrl))}
    </table></div>
  </details>`;
}

function filterButtons(name, options) {
  return html`<div class="filter"><span class="label">${capitalize(name)}</span><div class="segmented" role="group" aria-label="${name}">
    ${options.map(([value, label]) => html`<button type="button" data-filter="${name}" data-value="${value}" aria-pressed="${value === 'all'}">${label} <span class="count"></span></button>`)}
  </div></div>`;
}

function statTile(label, count, hint) {
  const percent = count.total === 0 ? 0 : Math.round((100 * count.passed) / count.total);
  return html`<div class="stat">
    <div class="label">${label}</div>
    <div class="stat-value"><span class="${tone(count)}-text">${count.passed}</span><span class="muted"> / ${count.total}</span></div>
    ${hint ? html`<div class="muted small">${hint}</div>` : html`<div class="bar"><div style="width: ${percent}%"></div></div>`}
  </div>`;
}

function contextLine(context) {
  const repoUrl = context.repo ? `${context.serverUrl}/${context.repo}` : null;
  const parts = [];
  if (context.repo) parts.push(html`<a href="${repoUrl}">${context.repo}</a>`);
  if (context.pullRequest) {
    parts.push(html`<a href="${repoUrl}/pull/${context.pullRequest.number}">#${context.pullRequest.number} ${context.pullRequest.title}</a>`);
  }
  if (context.sha) {
    const short = context.sha.slice(0, 7);
    parts.push(repoUrl ? html`<a class="sha mono" href="${repoUrl}/commit/${context.sha}">${short}</a>` : html`<span class="sha mono">${short}</span>`);
  }
  return parts.length ? html`<div class="context">${parts.map((part, index) => html`${index ? html`<span class="muted">·</span>` : ''}${part}`)}</div>` : '';
}

export function codeUrlFor(context) {
  if (!context.repo || !context.sha) return () => null;
  return (path, line) => `${context.serverUrl}/${context.repo}/blob/${context.sha}/${path}${line ? `#L${line}` : ''}`;
}

export function renderReport({ files, summary, context, title = 'Eval report', generatedAt = new Date() }) {
  const codeUrl = codeUrlFor(context);
  const allRuns = files.flatMap((file) => file.cases.flatMap((evalCase) => evalCase.runs));
  const totalMs = allRuns.reduce((sum, run) => sum + (run.durationMs ?? 0), 0);
  const facts = [
    generatedAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    `${files.length} ${files.length === 1 ? 'file' : 'files'}`,
    `${summary.cases.total} cases`,
    `${summary.runs.total} runs`,
    totalMs ? formatDuration(totalMs) + ' of runs' : '',
  ].filter(Boolean);
  const scopeName = summary.scope === 'pr' ? 'this PR' : 'this commit';
  return `<!doctype html>
${html`<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${trusted(asset('report.css'))}</style>
</head>
<body>
<header class="top"><div class="wrap top-inner">
  <div class="heading">
    ${contextLine(context)}
    <h1>${title}</h1>
    <div class="muted small">${facts.join(' · ')}</div>
  </div>
  <div class="stats">
    ${statTile('Runs passed', summary.runs)}
    ${statTile('Cases passed', summary.cases, 'A case passes when all its runs pass')}
    ${summary.fresh ? statTile(`New or changed in ${scopeName}`, summary.fresh.runs) : ''}
  </div>
</div></header>
<nav class="toolbar"><div class="wrap toolbar-inner">
  ${filterButtons('status', [['all', 'All'], ['passed', 'Passed'], ['failed', 'Failed']])}
  ${summary.fresh ? filterButtons('scope', [['all', 'All'], ['changed', 'New or changed']]) : ''}
  <span class="spacer"></span>
  <button type="button" class="plain" data-expand="true">Expand all</button>
  <button type="button" class="plain" data-expand="false">Collapse all</button>
</div></nav>
<main class="wrap">
  <p class="empty no-match" hidden>No runs match these filters.</p>
  ${files.length ? files.map((file) => fileSection(file, codeUrl)) : html`<p class="empty">No eval runs were recorded.</p>`}
</main>
<script>${trusted(asset('report.js'))}</script>
</body>
</html>`}
`;
}
