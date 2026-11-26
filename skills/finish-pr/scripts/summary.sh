#!/usr/bin/env bash
# Usage: summary.sh <pr>  (run in the branch's checkout)
# The links /finish-pr's summary shows: the PR, the previews deployed from its
# head commit, and each changed file that has code owners, linked to its diff
# in the PR. Ends with the phase timings.
set -euo pipefail
pr=$1
dir=$(cd "$(dirname "$0")" && pwd)
info=$(gh pr view "$pr" --json url,baseRefName,files)
url=$(jq -r .url <<<"$info")
base=$(jq -r .baseRefName <<<"$info")

echo "PR: $url"

# A host that deploys previews (Vercel, Netlify, Render, ...) records a GitHub
# deployment on the head commit seconds after a push, with the preview's
# address, long before the build is done. Where the repository's recent
# deployments include one that is not GitHub Pages, wait up to 20 seconds for
# this push's.
echo "Previews:"
deployments() {
  gh api graphql -F owner='{owner}' -F name='{repo}' -F n="$pr" -f query='
    query($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){
      deployments(last:10){nodes{environment}}
      pullRequest(number:$n){commits(last:1){nodes{commit{deployments(first:20){nodes{
        environment latestStatus{environmentUrl}}}}}}}}}' \
    --jq '.data.repository | ([.deployments.nodes[] | select(.environment != "github-pages")] | length | tostring),
      (.pullRequest.commits.nodes[0].commit.deployments.nodes[]
        | select((.latestStatus.environmentUrl // "") != "") | "- \(.environment): \(.latestStatus.environmentUrl)")' 2>/dev/null || echo 0
}
previews=""
for _ in 1 2 3 4 5; do
  found=$(deployments)
  previews=$(sed 1d <<<"$found")
  [[ -n $previews || $(sed -n 1p <<<"$found") == 0 ]] && break
  sleep 4
done
echo "${previews:-- none}"

# GitHub reads CODEOWNERS from the base branch, in the first of these places.
echo "Code owners' files:"
rules=$(mktemp)
where=""
for place in .github/CODEOWNERS CODEOWNERS docs/CODEOWNERS; do
  if git show "origin/$base:$place" >"$rules" 2>/dev/null; then where=$place; break; fi
done
if [[ -z $where ]]; then
  echo "- none: origin/$base has no CODEOWNERS"
else
  owned=$(jq -r '.files[].path' <<<"$info" | "$dir/owners.sh" "$rules")
  if [[ -z $owned ]]; then
    echo "- none: no changed file has a code owner"
  else
    while IFS=$'\t' read -r path who; do
      anchor=$(printf %s "$path" | { shasum -a 256 2>/dev/null || sha256sum; } | cut -c1-64)
      echo "- [$path]($url/files#diff-$anchor) ($who)"
    done <<<"$owned"
  fi
fi

timing=$("$dir/timer.sh" report)
[[ -z $timing ]] || echo "Timing: $timing"
