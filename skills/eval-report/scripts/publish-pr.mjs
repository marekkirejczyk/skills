#!/usr/bin/env node
// Puts the eval report on a pull request: one comment, updated in place, and a
// block at the top of the PR description, replaced on every run. Uses the gh
// CLI (GH_TOKEN in CI). No model calls.
//   publish-pr.mjs --pr <number> --summary summary.md --headline headline.md [--repo owner/name]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { COMMENT_MARK, withBlock } from './lib/pr-description.mjs';

const { values: args } = parseArgs({
  options: { pr: { type: 'string' }, repo: { type: 'string' }, summary: { type: 'string' }, headline: { type: 'string' } },
});
if (!args.pr || !args.summary || !args.headline) {
  console.error('publish-pr: --pr, --summary and --headline are required');
  process.exit(2);
}
const repo = args.repo || process.env.GITHUB_REPOSITORY || gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();

function gh(argv, input) {
  return execFileSync('gh', argv, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] });
}
function api(method, path, body) {
  const argv = ['api', '-X', method, path];
  if (body) argv.push('--input', '-');
  return JSON.parse(gh(argv, body && JSON.stringify(body)) || 'null');
}

const summary = `${COMMENT_MARK}\n${readFileSync(args.summary, 'utf8')}`;
const headline = readFileSync(args.headline, 'utf8');

const comments = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/issues/${args.pr}/comments?per_page=100`])).flat();
const existing = comments.find((comment) => comment.body && comment.body.includes(COMMENT_MARK));
if (existing) api('PATCH', `repos/${repo}/issues/comments/${existing.id}`, { body: summary });
else api('POST', `repos/${repo}/issues/${args.pr}/comments`, { body: summary });

const pr = api('GET', `repos/${repo}/pulls/${args.pr}`);
const description = withBlock(pr.body, headline);
if (description !== pr.body) api('PATCH', `repos/${repo}/pulls/${args.pr}`, { body: description });

console.log(`Eval report linked on ${repo}#${args.pr}`);
