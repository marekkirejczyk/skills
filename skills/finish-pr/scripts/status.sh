#!/usr/bin/env bash
# Usage: status.sh  (run in the branch's checkout)
# Everything /finish-pr needs before it starts, in one call: the branch, its
# base, its open PR if any, and what the branch changes. Fetches the base and
# starts the timer.
set -euo pipefail
dir=$(cd "$(dirname "$0")" && pwd)
"$dir/timer.sh" start

branch=$(git branch --show-current)
# No PR for the branch is an answer; any other failure (offline, signed out)
# must not pass for one, or a stacked branch gets reviewed against the wrong base.
if ! pr=$(gh pr view --json number,url,isDraft,baseRefName,body,state 2>&1); then
  grep -qi 'no pull requests found' <<<"$pr" || { echo "gh could not read the branch's PR: $pr" >&2; exit 1; }
  pr='{}'
fi
[[ $(jq -r '.state // ""' <<<"$pr") == OPEN ]] || pr='{}'
default=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@' || true)
[[ -n $default ]] || default=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
# The base: the open PR's, else the one `gh pr create` would use for this
# branch (set it for a stacked PR), else the default branch.
base=$(jq -r '.baseRefName // empty' <<<"$pr")
base=${base:-$(git config --get "branch.$branch.gh-merge-base" || true)}
base=${base:-$default}
git fetch -q origin "$base"

files=$(git diff --name-status "origin/$base...HEAD")

echo "branch: $branch"
echo "base: origin/$base ($(git rev-list --count "HEAD..origin/$base") behind, $(git rev-list --count "origin/$base..HEAD") ahead)"
echo "head: $(git rev-parse --short HEAD)"
jq -r 'if .number then "pr: #\(.number) \(.url) \(if .isDraft then "draft" else "ready" end)" else "pr: none" end' <<<"$pr"
# An earlier run of /finish-pr left "Reviewed `<sha>`: ..., fixed ... in `<sha>`"
# in the PR's description. The review is done when one of those is still the head.
reviewed=no
head=$(git rev-parse HEAD)
while IFS= read -r sha; do
  [[ -n $sha && $head == "$sha"* ]] && reviewed=yes
done < <(jq -r '.body // ""' <<<"$pr" | grep -m1 -E '^Reviewed `' | grep -oE '`[0-9a-f]{7,40}`' | tr -d '`' || true)
echo "reviewed: $reviewed"
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
