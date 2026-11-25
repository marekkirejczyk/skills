// Everything the report learns from git: which cases are new or changed in a
// scope (a commit or a PR), each case's line, and links to the code on GitHub.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return null;
  }
}

export function repoRoot(cwd) {
  return git(cwd, ['rev-parse', '--show-toplevel']);
}

// The commit the scope is measured from.
export function baseRef(root, scope, explicitBase) {
  if (explicitBase) return explicitBase;
  if (scope === 'commit') return 'HEAD~1';
  const branch = process.env.GITHUB_BASE_REF || defaultBranch(root);
  for (const candidate of [`origin/${branch}`, branch]) {
    const mergeBase = git(root, ['merge-base', 'HEAD', candidate]);
    if (mergeBase) return mergeBase;
  }
  throw new Error(`Cannot find the base of this PR: no merge base with ${branch}. Pass --base <ref>.`);
}

function defaultBranch(root) {
  const head = git(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  return head ? head.replace(/^origin\//, '') : 'main';
}

// Line numbers in the working tree that differ from base, per file.
export function changedLines(root, base, path) {
  const diff = git(root, ['diff', '-U0', base, '--', path]);
  const lines = new Set();
  if (!diff) return lines;
  for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    // A pure deletion (count 0) still changes the case around it.
    for (let line = start; line < start + Math.max(count, 1); line++) lines.add(line);
  }
  return lines;
}

export function fileAtBase(root, base, path) {
  return git(root, ['show', `${base}:${path}`]);
}

// Fills in a missing line by finding the case's name in its file.
export function locateCases(root, report) {
  for (const file of report.files) {
    const fullPath = join(root, file.path);
    if (!existsSync(fullPath)) continue;
    const lines = readFileSync(fullPath, 'utf8').split('\n');
    for (const evalCase of file.cases) {
      if (evalCase.line) continue;
      const index = lines.findIndex((line) => line.includes(evalCase.name));
      if (index >= 0) evalCase.line = index + 1;
    }
  }
}

// Marks each case 'new', 'changed' or null against base.
// New: its file or its name is not in base. Changed: a changed line falls
// between its line and the next case's line (or anywhere in the file, when
// the case has no line).
export function markFresh(root, report, base) {
  for (const file of report.files) {
    const before = fileAtBase(root, base, file.path);
    const fullPath = join(root, file.path);
    const current = existsSync(fullPath) ? readFileSync(fullPath, 'utf8').split('\n') : [];
    // A blank line between two cases belongs to neither.
    const changed = new Set([...changedLines(root, base, file.path)].filter((line) => (current[line - 1] ?? '').trim()));
    const starts = file.cases.map((evalCase) => evalCase.line).filter(Boolean).sort((a, b) => a - b);
    for (const evalCase of file.cases) {
      if (before === null || !before.includes(evalCase.name)) { evalCase.fresh = 'new'; continue; }
      if (!changed.size) continue;
      if (!evalCase.line) { evalCase.fresh = 'changed'; continue; }
      const next = starts.find((start) => start > evalCase.line) ?? Infinity;
      for (const line of changed) {
        if (line >= evalCase.line && line < next) { evalCase.fresh = 'changed'; break; }
      }
    }
  }
}

export function changedFiles(root, base) {
  const out = git(root, ['diff', '--name-only', base]);
  return out ? out.split('\n').filter(Boolean) : [];
}

// "owner/repo" for a GitHub remote, or null.
export function githubRepo(root) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const remote = git(root, ['remote', 'get-url', 'origin']);
  const match = remote && remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

export function headSha(root) {
  return git(root, ['rev-parse', 'HEAD']);
}

export function linkCode(report, repo, sha) {
  if (!repo || !sha) return;
  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  for (const file of report.files) {
    for (const evalCase of file.cases) {
      evalCase.codeUrl = `${server}/${repo}/blob/${sha}/${file.path}${evalCase.line ? `#L${evalCase.line}` : ''}`;
    }
  }
}
