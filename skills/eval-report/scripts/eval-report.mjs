#!/usr/bin/env node
// Turns eval results into a static HTML report and a Markdown summary.
// No dependencies, no model calls. Usage: see --help.
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildReport, loadResults, onlyFresh, stats } from './lib/load.mjs';
import { baseRef, changedFiles, githubRepo, headSha, linkCode, locateCases, markFresh, repoRoot } from './lib/git.mjs';
import { renderHtml } from './lib/render-html.mjs';
import { renderHeadline, renderSummary } from './lib/render-summary.mjs';

const HELP = `eval-report [results.json|.jsonl] [options]

  --config <file>      settings file (default: .eval-report.json in the repo root, if present)
  --adapter <file>     ES module whose default export turns your runner's output into the eval-report format
  --scope commit|pr    mark cases new or changed in the last commit, or in this branch against its base
  --only               keep only new or changed cases (needs --scope)
  --base <ref>         compare against this ref instead of the scope's default
  --run                run the evals first (the config's "run", or "runChanged" with --only)
  --out <file>         HTML report (default: .eval-report/index.html)
  --summary <file>     Markdown summary for a PR comment or a CI job summary
  --headline <file>    one-line Markdown summary for the top of a PR description
  --report-url <url>   where the HTML report will be published, for links in the summary
  --sha <sha>          commit to link code to (default: HEAD)
  --title <text>       report title (default: "Eval report")
  --open               open the HTML report when done
  --help`;

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: 'string' }, adapter: { type: 'string' }, scope: { type: 'string' }, only: { type: 'boolean' },
    base: { type: 'string' }, run: { type: 'boolean' }, out: { type: 'string' }, summary: { type: 'string' },
    headline: { type: 'string' }, 'report-url': { type: 'string' }, sha: { type: 'string' }, title: { type: 'string' },
    open: { type: 'boolean' }, help: { type: 'boolean' },
  },
});

if (args.help) { console.log(HELP); process.exit(0); }
if (args.scope && !['commit', 'pr'].includes(args.scope)) fail(`--scope must be "commit" or "pr", not "${args.scope}"`);
if (args.only && !args.scope) fail('--only needs --scope commit or --scope pr');

const root = repoRoot(process.cwd()) || process.cwd();
const configPath = args.config || join(root, '.eval-report.json');
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
const fromConfig = (p) => (p ? resolve(args.config ? dirname(configPath) : root, p) : null);

const resultsPath = positionals[0] ? resolve(positionals[0]) : fromConfig(config.results);
if (!resultsPath) fail('No results file. Pass one, or set "results" in .eval-report.json.');
const adapterPath = args.adapter ? resolve(args.adapter) : fromConfig(config.adapter);
const base = args.scope ? baseRef(root, args.scope, args.base || config.base) : null;

if (args.run) runEvals();
if (!existsSync(resultsPath)) fail(`Results file not found: ${resultsPath}`);

let report = buildReport(await loadResults(resultsPath, adapterPath));
locateCases(root, report);
if (base) markFresh(root, report, base);
if (args.only) report = onlyFresh(report);

const repo = githubRepo(root);
const sha = args.sha || process.env.EVAL_REPORT_SHA || headSha(root);
linkCode(report, repo, sha);
report.meta = {
  ...report.meta,
  title: args.title || config.title || report.meta.title,
  repo: report.meta.repo || repo,
  repoUrl: report.meta.repoUrl || (repo ? `https://github.com/${repo}` : null),
  sha: report.meta.sha || sha,
  pr: report.meta.pr || (args.scope === 'pr' ? currentPr() : null),
};

const scope = args.scope || null;
const reportUrl = args['report-url'] || null;
const totals = stats(report);
const wantsHtml = args.out || !(args.summary || args.headline);
const outPath = resolve(args.out || config.out || join(root, '.eval-report/index.html'));
if (wantsHtml) write(outPath, renderHtml(report, { scope }));
if (args.summary) write(resolve(args.summary), renderSummary(report, { reportUrl, scope }));
if (args.headline) write(resolve(args.headline), renderHeadline(report, { reportUrl, scope }));

console.log(`${totals.runsPassed}/${totals.runs} rounds passed, ${totals.casesPassed}/${totals.cases} cases` +
  (scope ? `, ${totals.freshCases} new or changed` : ''));
if (wantsHtml) console.log(`Report: ${outPath}`);
if (wantsHtml && args.open) openFile(outPath);

function runEvals() {
  let command = config.run;
  if (args.only && config.runChanged && config.evalFiles) {
    const pattern = new RegExp(config.evalFiles);
    const files = changedFiles(root, base).filter((file) => pattern.test(file) && existsSync(join(root, file)));
    if (!files.length) { console.log('No eval files changed: nothing to run.'); }
    else command = config.runChanged.replace('{files}', files.map((f) => JSON.stringify(f)).join(' '));
  }
  if (!command) fail('--run needs "run" in .eval-report.json');
  console.log(`$ ${command}`);
  try {
    execSync(command, { cwd: root, stdio: 'inherit' });
  } catch {
    console.log('The eval command exited non-zero (failed evals usually do); building the report anyway.');
  }
}

function currentPr() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    const pr = JSON.parse(readFileSync(eventPath, 'utf8')).pull_request;
    if (pr) return { number: pr.number, title: pr.title, url: pr.html_url };
  }
  try {
    const out = execFileSync('gh', ['pr', 'view', '--json', 'number,title,url'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function openFile(path) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  try { execFileSync(command, [path], { stdio: 'ignore' }); } catch { /* the path is printed above */ }
}

function fail(message) {
  console.error(`eval-report: ${message}`);
  process.exit(2);
}
