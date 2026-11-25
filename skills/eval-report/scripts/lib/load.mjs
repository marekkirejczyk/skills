// Reads eval results and turns them into the report model:
// { meta, files: [{ path, cases: [{ id, name, line, rule, knownBug, runs: [...] }] }] }
// The input format is described in reference/format.md.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadResults(resultsPath, adapterPath) {
  const text = readFileSync(resultsPath, 'utf8');
  let raw;
  if (resultsPath.endsWith('.jsonl')) {
    raw = text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  } else {
    raw = JSON.parse(text);
  }
  if (adapterPath) {
    const adapter = await import(pathToFileURL(resolve(adapterPath)).href);
    raw = await adapter.default(raw);
  }
  return raw;
}

export function buildReport(raw) {
  const results = Array.isArray(raw) ? raw : raw.results;
  if (!Array.isArray(results)) throw new Error('Expected an array of results, or { "results": [...] }');
  const meta = Array.isArray(raw) ? {} : raw.meta || {};

  const filesByPath = new Map();
  results.forEach((result, index) => {
    const path = result.file || '(no file)';
    const name = result.name || result.case || `case ${index + 1}`;
    if (!filesByPath.has(path)) filesByPath.set(path, { path, cases: new Map() });
    const file = filesByPath.get(path);
    if (!file.cases.has(name)) {
      file.cases.set(name, {
        name,
        line: result.line ?? null,
        rule: result.rule || '',
        knownBug: result.knownBug || '',
        fresh: null,
        codeUrl: null,
        runs: [],
      });
    }
    const evalCase = file.cases.get(name);
    evalCase.line ??= result.line ?? null;
    evalCase.rule ||= result.rule || '';
    evalCase.knownBug ||= result.knownBug || '';
    evalCase.runs.push(normalizeRun(result, evalCase.runs.length + 1));
  });

  const files = [...filesByPath.values()].map((file) => {
    const cases = [...file.cases.values()];
    cases.forEach((evalCase) => evalCase.runs.sort((a, b) => a.round - b.round));
    cases.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity));
    return { path: file.path, cases };
  });
  files.sort((a, b) => a.path.localeCompare(b.path));
  files.forEach((file) => file.cases.forEach((evalCase, index) => {
    evalCase.id = slug(`${file.path}-${evalCase.name}`) || `case-${index}`;
  }));
  return { meta, files };
}

function normalizeRun(result, fallbackRound) {
  const checks = (result.checks || []).map((check) => ({
    kind: check.kind || 'checks',
    label: check.label || check.name || '',
    pass: Boolean(check.pass),
    reason: check.reason || check.detail || '',
  }));
  if (result.error) checks.push({ kind: 'error', label: String(result.error), pass: false, reason: '' });
  const pass = typeof result.pass === 'boolean' ? result.pass : checks.every((check) => check.pass);
  return {
    round: result.round ?? fallbackRound,
    pass,
    durationMs: result.durationMs ?? null,
    input: result.input ?? null,
    output: result.output ?? null,
    checks,
    mocks: (result.mocks || []).map((mock) => ({
      tool: mock.tool || mock.name || '?',
      args: mock.args,
      result: mock.result,
      fake: mock.fake || '',
    })),
  };
}

export function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export function stats(report) {
  const totals = { runs: 0, runsPassed: 0, cases: 0, casesPassed: 0, freshRuns: 0, freshRunsPassed: 0, freshCases: 0 };
  for (const file of report.files) {
    file.runs = 0; file.runsPassed = 0;
    for (const evalCase of file.cases) {
      const passed = evalCase.runs.filter((run) => run.pass).length;
      evalCase.runsPassed = passed;
      evalCase.pass = passed === evalCase.runs.length;
      file.runs += evalCase.runs.length; file.runsPassed += passed;
      totals.cases++; if (evalCase.pass) totals.casesPassed++;
      if (evalCase.fresh) { totals.freshCases++; totals.freshRuns += evalCase.runs.length; totals.freshRunsPassed += passed; }
    }
    totals.runs += file.runs; totals.runsPassed += file.runsPassed;
  }
  totals.durationMs = report.meta.durationMs
    ?? report.files.flatMap((f) => f.cases.flatMap((c) => c.runs)).reduce((sum, run) => sum + (run.durationMs || 0), 0);
  return totals;
}

export function onlyFresh(report) {
  return {
    ...report,
    files: report.files
      .map((file) => ({ ...file, cases: file.cases.filter((evalCase) => evalCase.fresh) }))
      .filter((file) => file.cases.length),
  };
}
