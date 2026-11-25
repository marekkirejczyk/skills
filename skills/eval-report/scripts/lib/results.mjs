// Reads the runs an eval command recorded and groups them into
// files → cases → runs. The format is described in reference/input-format.md.

export function parseResults(text) {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  const whole = tryParseJson(trimmed);
  if (whole.ok) {
    if (Array.isArray(whole.value)) return whole.value;
    if (Array.isArray(whole.value?.runs)) return whole.value.runs;
    return [whole.value];
  }
  return trimmed.split('\n').flatMap((line, index) => {
    if (line.trim() === '') return [];
    const parsed = tryParseJson(line);
    if (!parsed.ok) throw new Error(`results line ${index + 1} is not JSON: ${parsed.error}`);
    return [parsed.value];
  });
}

function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function normalizeRun(record, index) {
  const where = `run ${index + 1}`;
  if (typeof record?.file !== 'string' || record.file === '') throw new Error(`${where}: "file" must be a non-empty string`);
  if (typeof record.case !== 'string' || record.case === '') throw new Error(`${where}: "case" must be a non-empty string`);
  const checks = (record.checks ?? []).map((check) => ({
    kind: check.kind ?? 'checks',
    name: String(check.name ?? ''),
    passed: Boolean(check.passed),
    reason: check.reason ?? '',
    about: check.about ? String(check.about) : '',
  }));
  const error = record.error ? String(record.error) : '';
  const passedByChecks = checks.length > 0 && checks.every((check) => check.passed);
  return {
    file: record.file.replace(/^\.\//, ''),
    case: record.case,
    line: Number.isInteger(record.line) ? record.line : null,
    round: Number.isInteger(record.round) ? record.round : null,
    passed: error === '' && (typeof record.passed === 'boolean' ? record.passed : passedByChecks),
    durationMs: typeof record.durationMs === 'number' ? record.durationMs : null,
    rule: record.rule ?? '',
    note: record.note ?? '',
    change: record.change ?? null,
    input: record.input,
    output: record.output,
    error,
    checks,
    mocks: (record.mocks ?? []).map((mock) => ({
      tool: String(mock.tool ?? ''),
      args: mock.args,
      result: mock.result,
      summary: mock.summary,
      fake: mock.fake ?? '',
    })),
  };
}

export function groupRuns(runs) {
  const files = new Map();
  for (const run of runs) {
    if (!files.has(run.file)) files.set(run.file, { path: run.file, cases: new Map() });
    const cases = files.get(run.file).cases;
    if (!cases.has(run.case)) {
      cases.set(run.case, { name: run.case, line: run.line, rule: run.rule, note: run.note, change: run.change, runs: [] });
    }
    const evalCase = cases.get(run.case);
    evalCase.line ??= run.line;
    evalCase.rule ||= run.rule;
    evalCase.note ||= run.note;
    evalCase.change ??= run.change;
    evalCase.runs.push({ ...run, round: run.round ?? evalCase.runs.length + 1 });
  }
  return [...files.values()].map((file) => ({
    path: file.path,
    cases: [...file.cases.values()].map((evalCase) => ({
      ...evalCase,
      runs: evalCase.runs.sort((a, b) => a.round - b.round),
      passed: evalCase.runs.every((run) => run.passed),
    })),
  }));
}

// The line a case is defined on: the first line quoting its name.
export function findCaseLine(source, name) {
  const lines = source.split('\n');
  const quoted = ['"', "'", '`'].map((quote) => quote + name + quote);
  const index = lines.findIndex((line) => quoted.some((text) => line.includes(text)));
  return index === -1 ? null : index + 1;
}

export function fillCaseLines(files, readSource) {
  for (const file of files) {
    const source = readSource(file.path);
    if (source === null) continue;
    for (const evalCase of file.cases) evalCase.line ??= findCaseLine(source, evalCase.name);
  }
  return files;
}

export function countRuns(runs) {
  return { passed: runs.filter((run) => run.passed).length, total: runs.length };
}
