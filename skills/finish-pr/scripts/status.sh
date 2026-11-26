#!/usr/bin/env bash
# Usage: status.sh  (run in the branch's checkout)
# Everything /finish-pr needs before it starts, in one call: the branch, its
# base, its open PR if any, and what the branch changes. Fetches the base and
# starts the timer.
set -euo pipefail
dir=$(cd "$(dirname "$0")" && pwd)
"$dir/timer.sh" start

branch=$(git branch --show-current)
pr=$(gh pr view --json number,url,isDraft,baseRefName,body,state 2>/dev/null || echo '{}')
[[ $(jq -r '.state // ""' <<<"$pr") == OPEN ]] || pr='{}'
default=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@' || true)
# The base: the open PR's, else the one `gh pr create` would use for this
# branch (set it for a stacked PR), else the default branch.
base=$(jq -r '.baseRefName // empty' <<<"$pr")
base=${base:-$(git config --get "branch.$branch.gh-merge-base" || true)}
base=${base:-${default:-main}}
git fetch -q origin "$base"

files=$(git diff --name-status "origin/$base...HEAD")

echo "branch: $branch"
echo "base: origin/$base ($(git rev-list --count "HEAD..origin/$base") behind, $(git rev-list --count "origin/$base..HEAD") ahead)"
echo "head: $(git rev-parse --short HEAD)"
jq -r 'if .number then "pr: #\(.number) \(.url) \(if .isDraft then "draft" else "ready" end)" else "pr: none" end' <<<"$pr"
# What an earlier run of /finish-pr recorded in the PR's description.
reviewed=$(jq -r '.body // ""' <<<"$pr" | grep -m1 -E '^- \[x\] Self-review' || true)
echo "reviewed: ${reviewed:-no}"
# UI: a file that draws something changed (a stylesheet, a template or a component).
ui=no
if grep -qE '\.(css|scss|sass|less|styl|tsx|jsx|vue|svelte|astro|html|erb|swift|kt)$' <<<"$files"; then ui=yes; fi
echo "ui: $ui"
echo "uncommitted:"
git status --porcelain | sed 's/^/  /'
echo "commits:"
git log --oneline "origin/$base..HEAD" | sed 's/^/  /'
echo "base history:"
git log --oneline -5 "origin/$base" | sed 's/^/  /'
echo "files:"
sed 's/^/  /' <<<"$files"
