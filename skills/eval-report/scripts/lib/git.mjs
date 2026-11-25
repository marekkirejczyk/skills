// Everything the report needs from git, gh and the GitHub Actions environment.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { markFilesAdded, parseDiff } from './scope.mjs';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export function exec(command, args, { cwd, input } = {}) {
  return execFileSync(command, args, { cwd, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
}

export function tryExec(command, args, options) {
  try {
    return exec(command, args, options);
  } catch {
    return null;
  }
}

export function parseGitHubRemote(url) {
  const match = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(url ?? '');
  return match ? `${match[1]}/${match[2]}` : null;
}

function readEvent(env) {
  if (!env.GITHUB_EVENT_PATH) return null;
  try {
    return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function localPullRequest() {
  const json = tryExec('gh', ['pr', 'view', '--json', 'number,title,baseRefName']);
  return json ? JSON.parse(json) : null;
}

// Repo, commit and pull request the report is for. On Actions it comes from
// the environment; locally from git and, when it is installed, gh.
export function githubContext(env = process.env) {
  const event = readEvent(env);
  const pull = event?.pull_request ?? (env.GITHUB_ACTIONS ? null : localPullRequest());
  return {
    serverUrl: env.GITHUB_SERVER_URL ?? 'https://github.com',
    repo: env.GITHUB_REPOSITORY ?? parseGitHubRemote(tryExec('git', ['remote', 'get-url', 'origin'])),
    sha: pull?.head?.sha ?? env.GITHUB_SHA ?? tryExec('git', ['rev-parse', 'HEAD']),
    pullRequest: pull ? { number: pull.number, title: pull.title } : null,
    baseBranch: env.GITHUB_BASE_REF || pull?.base?.ref || pull?.baseRefName || 'main',
  };
}

function scopeBase(scope, baseBranch) {
  if (scope === 'commit') return tryExec('git', ['rev-parse', '--verify', '--quiet', 'HEAD~1']) ?? EMPTY_TREE;
  for (const ref of [`origin/${baseBranch}`, baseBranch]) {
    const base = tryExec('git', ['merge-base', ref, 'HEAD']);
    if (base) return base;
  }
  throw new Error(`no merge base with ${baseBranch}: fetch it, or on Actions check out with fetch-depth: 0`);
}

// Lines touched since the scope's base, uncommitted and untracked files included.
export function changesInScope(scope, baseBranch) {
  const base = scopeBase(scope, baseBranch);
  const changes = parseDiff(exec('git', ['diff', '-U0', '--no-color', '--no-renames', base]));
  const untracked = exec('git', ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  return markFilesAdded(changes, untracked);
}
