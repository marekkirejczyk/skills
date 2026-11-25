#!/usr/bin/env node
// eval-report: runs a repository's evals and turns what they recorded into one
// static HTML page, then (on GitHub) links it from the pull request.
//
//   eval-report.mjs run     [--config .eval-report.json] [--scope all|commit|pr] [--only] [--out eval-report]
//   eval-report.mjs build   --results <file> [--config ...] [--scope ...] [--out ...]
//   eval-report.mjs publish [--out eval-report] [--url <url> | --pages] [--no-comment]
//
// Run it from the repository root. See ../reference/input-format.md.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { changesInScope, githubContext } from './lib/git.mjs';
import { fillCaseLines, groupRuns, normalizeRun, parseResults } from './lib/results.mjs';
import { changedEvalFiles, markChangedCases, SCOPES } from './lib/scope.mjs';
import { renderReport } from './lib/report.mjs';
import { commandFor } from './lib/command.mjs';
import { bodyBlock, commentBody, summarize, summaryLine } from './lib/summary.mjs';
import { publishToPages, updatePullRequestBody, upsertComment } from './lib/publish.mjs';

const RESULTS_FILE = 'results.ndjson';
const PAGE_FILE = 'eval-report.html';

const OPTIONS = {
  config: { type: 'string', default: '.eval-report.json' },
  scope: { type: 'string', default: 'all' },
  only: { type: 'boolean', default: false },
  out: { type: 'string', default: 'eval-report' },
  results: { type: 'string' },
  pages: { type: 'boolean', default: false },
  url: { type: 'string' },
  'no-comment': { type: 'boolean', default: false },
};

function loadConfig(path) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readSource(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function build({ resultsPath, scope, outDir, config, changes, context }) {
  const runs = parseResults(readFileSync(resultsPath, 'utf8')).map(normalizeRun);
  const files = fillCaseLines(groupRuns(runs), readSource);
  if (changes) markChangedCases(files, changes);
  const summary = summarize(files, scope);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, PAGE_FILE), renderReport({ files, summary, context, title: config.title }));
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`${summaryLine(summary)}\nReport: ${resolve(outDir, PAGE_FILE)}`);
  return summary;
}

function runEvals(values, config, context) {
  if (!config.command) throw new Error(`no "command" in ${values.config}: say how to run the evals there`);
  const changes = values.scope === 'all' ? null : changesInScope(values.scope, context.baseBranch);
  const files = values.only ? changedEvalFiles(changes, config.evals ?? []) : [];
  const resultsPath = join(values.out, RESULTS_FILE);
  mkdirSync(values.out, { recursive: true });
  writeFileSync(resultsPath, '');
  let exitCode = 0;
  if (values.only && files.length === 0) {
    console.log('No new or changed eval files in scope: nothing to run.');
  } else {
    const command = commandFor(config.command, files, values.only);
    console.log(`$ ${command}`);
    const result = spawnSync('sh', ['-c', command], { stdio: 'inherit', env: { ...process.env, EVAL_REPORT_FILE: resolve(resultsPath) } });
    exitCode = result.status ?? 1;
  }
  build({ resultsPath, scope: values.scope, outDir: values.out, config, changes, context });
  return exitCode;
}

function publish(values, context) {
  const summary = JSON.parse(readFileSync(join(values.out, 'summary.json'), 'utf8'));
  if (!context.repo) throw new Error('not a GitHub repository: nothing to publish to');
  const pull = context.pullRequest;
  const url = values.pages
    ? publishToPages({ page: join(values.out, PAGE_FILE), repo: context.repo, slug: pull ? `pr-${pull.number}` : `commit-${context.sha.slice(0, 7)}` })
    : values.url;
  if (!url) throw new Error('say where the report is: --pages, or --url <url>');
  console.log(`Report URL: ${url}`);
  if (!pull) return 0;
  updatePullRequestBody({ repo: context.repo, number: pull.number, block: bodyBlock(summary, url) });
  if (!values['no-comment']) upsertComment({ repo: context.repo, number: pull.number, body: commentBody(summary, url) });
  console.log(`Linked from pull request #${pull.number}`);
  return 0;
}

function main(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  const [command] = positionals;
  if (!SCOPES.includes(values.scope)) throw new Error(`--scope must be one of ${SCOPES.join(', ')}`);
  if (values.only && values.scope === 'all') throw new Error('--only needs --scope commit or --scope pr');
  const config = loadConfig(values.config);
  const context = githubContext();
  switch (command) {
    case 'run':
      return runEvals(values, config, context);
    case 'build': {
      if (!values.results) throw new Error('build needs --results <file>');
      const changes = values.scope === 'all' ? null : changesInScope(values.scope, context.baseBranch);
      build({ resultsPath: values.results, scope: values.scope, outDir: values.out, config, changes, context });
      return 0;
    }
    case 'publish':
      return publish(values, context);
    default:
      throw new Error('usage: eval-report.mjs run|build|publish [options]');
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`eval-report: ${error.message}`);
  process.exitCode = 2;
}
