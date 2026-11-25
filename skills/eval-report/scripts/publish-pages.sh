#!/usr/bin/env bash
# Publishes a report to the gh-pages branch and prints its URL.
#   publish-pages.sh <report.html> <path on the site, e.g. eval-reports/pr-12>
# Needs push access to origin (in GitHub Actions: permissions: contents: write)
# and GitHub Pages serving the gh-pages branch. No model calls.
set -euo pipefail

src=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
dest=${2%/}
repo=${GITHUB_REPOSITORY:-$(git remote get-url origin | sed -E 's#.*github\.com[:/]##; s#\.git$##')}
owner=${repo%%/*}
name=${repo#*/}
owner_lower=$(printf '%s' "$owner" | tr '[:upper:]' '[:lower:]')
if [ "$name" = "$owner_lower.github.io" ]; then site="https://$owner_lower.github.io"; else site="https://$owner_lower.github.io/$name"; fi

work=$(mktemp -d)
trap 'git worktree remove --force "$work" >/dev/null 2>&1 || rm -rf "$work"' EXIT

if git fetch --quiet --depth 1 origin gh-pages 2>/dev/null; then
  git worktree add --quiet --detach "$work" FETCH_HEAD
else
  git worktree add --quiet --detach "$work"
  git -C "$work" checkout --quiet --orphan gh-pages
  git -C "$work" rm -rfq . >/dev/null 2>&1 || true
  git -C "$work" clean -fdxq
fi

commit_and_push() {
  mkdir -p "$work/$dest"
  cp "$src" "$work/$dest/index.html"
  touch "$work/.nojekyll"
  git -C "$work" add -A
  if git -C "$work" diff --cached --quiet; then return 0; fi
  git -C "$work" -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    commit --quiet -m "eval report: $dest"
  git -C "$work" push --quiet origin HEAD:refs/heads/gh-pages
}

# Another job may push to gh-pages at the same time: start again from the new tip.
for attempt in 1 2 3 4 5; do
  if commit_and_push; then echo "$site/$dest/"; exit 0; fi
  sleep $((attempt * 2))
  git -C "$work" fetch --quiet --depth 1 origin gh-pages
  git -C "$work" reset --quiet --hard FETCH_HEAD
done
echo "publish-pages: could not push to gh-pages" >&2
exit 1
