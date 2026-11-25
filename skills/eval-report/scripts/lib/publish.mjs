// Hosting a report on GitHub Pages and putting its link on a pull request,
// with git and gh only.

import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exec, tryExec } from './git.mjs';
import { COMMENT_MARKER, upsertBodyBlock } from './summary.mjs';

const BOT = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];

function pagesUrl(repo) {
  const configured = tryExec('gh', ['api', `repos/${repo}/pages`, '--jq', '.html_url']);
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`;
  const [owner, name] = repo.split('/');
  return `https://${owner}.github.io/${name}/`;
}

// Pages sites are public unless the repository is private and its Pages
// visibility is set to private (GitHub Enterprise Cloud). Eval inputs and
// outputs of a private repository must not end up on a public site.
export function pagesExposePrivateRepo({ repoIsPrivate, pagesArePublic }) {
  return repoIsPrivate && pagesArePublic;
}

function assertPagesKeepRepoPrivate(repo) {
  const repoIsPrivate = exec('gh', ['api', `repos/${repo}`, '--jq', '.private']) === 'true';
  // No Pages site yet, or a plan without the setting, means public.
  const pagesArePublic = tryExec('gh', ['api', `repos/${repo}/pages`, '--jq', '.public']) !== 'false';
  if (pagesExposePrivateRepo({ repoIsPrivate, pagesArePublic })) {
    throw new Error(`${repo} is private but its GitHub Pages site would be public: link the uploaded artifact with --url instead (see the eval-report-install-ci skill)`);
  }
}

// Commits the page to <branch>/<folder>/<slug>/index.html and returns its URL.
export function publishToPages({ page, repo, slug, branch = 'gh-pages', folder = 'eval-reports' }) {
  assertPagesKeepRepoPrivate(repo);
  const worktree = mkdtempSync(join(tmpdir(), 'eval-report-pages-'));
  const exists = tryExec('git', ['fetch', '--quiet', 'origin', branch]) !== null;
  try {
    exec('git', ['worktree', 'add', '--quiet', '--detach', worktree, exists ? 'FETCH_HEAD' : 'HEAD']);
    if (!exists) {
      exec('git', ['checkout', '--quiet', '--orphan', `eval-report-pages-${process.pid}`], { cwd: worktree });
      exec('git', ['rm', '-rfq', '--ignore-unmatch', '.'], { cwd: worktree });
      writeFileSync(join(worktree, '.nojekyll'), '');
    }
    const target = join(worktree, folder, slug);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    copyFileSync(page, join(target, 'index.html'));
    exec('git', ['add', '--all'], { cwd: worktree });
    if (tryExec('git', ['diff', '--cached', '--quiet'], { cwd: worktree }) === null) {
      exec('git', [...BOT, 'commit', '--quiet', '-m', `eval report: ${slug}`], { cwd: worktree });
      pushWithRetry(worktree, branch);
    }
  } finally {
    tryExec('git', ['worktree', 'remove', '--force', worktree]);
    rmSync(worktree, { recursive: true, force: true });
  }
  return `${pagesUrl(repo)}${folder}/${slug}/`;
}

// Another job may publish between our fetch and push: rebase onto it and retry.
function pushWithRetry(worktree, branch, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    if (tryExec('git', ['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`], { cwd: worktree }) !== null) return;
    if (attempt === attempts) throw new Error(`could not push to ${branch} after ${attempts} attempts`);
    exec('git', ['fetch', '--quiet', 'origin', branch], { cwd: worktree });
    exec('git', [...BOT, 'rebase', '--quiet', 'FETCH_HEAD'], { cwd: worktree });
  }
}

function withTempFile(text, use) {
  const directory = mkdtempSync(join(tmpdir(), 'eval-report-'));
  const file = join(directory, 'body.md');
  writeFileSync(file, text);
  try {
    return use(file);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function updatePullRequestBody({ repo, number, block }) {
  const body = exec('gh', ['pr', 'view', String(number), '--repo', repo, '--json', 'body', '--jq', '.body']);
  withTempFile(upsertBodyBlock(body, block), (file) => exec('gh', ['pr', 'edit', String(number), '--repo', repo, '--body-file', file]));
}

export function upsertComment({ repo, number, body }) {
  const ids = exec('gh', ['api', '--paginate', `repos/${repo}/issues/${number}/comments`, '--jq', `.[] | select(.body | contains("${COMMENT_MARKER}")) | .id`]);
  const existing = ids.split('\n').find(Boolean);
  withTempFile(body, (file) =>
    existing
      ? exec('gh', ['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${existing}`, '-F', `body=@${file}`])
      : exec('gh', ['api', '--method', 'POST', `repos/${repo}/issues/${number}/comments`, '-F', `body=@${file}`]),
  );
}
