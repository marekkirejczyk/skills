#!/usr/bin/env bash
# Usage: owners.sh <CODEOWNERS file> < paths
# For each path on stdin that has a code owner, prints the path, a tab, and
# its owners.
#
# CODEOWNERS patterns are .gitignore-style, so git's own ignore matcher tests
# them, one rule at a time: given the whole file it would let a rule that
# matches a parent folder beat a later rule, where CODEOWNERS lets the last
# matching rule win. A rule with no owner takes its files' owners away. Two
# more places CODEOWNERS differs: a rule may end in a comment, and `docs/*`
# owns only the files directly in docs/, where git would take everything
# below it.
set -euo pipefail
rules=$(cat "$1")
paths=$(cat)
[[ -n $paths ]] || exit 0
tmp=$(mktemp -d)
trap '[[ -n $tmp ]] && rm -rf "$tmp"' EXIT
git init -q "$tmp"
# Only the rule under test may match: not the user's own ignore file. Paths
# come back as they went in, and case counts, as it does on GitHub.
matching() {
  git -C "$tmp" -c core.excludesFile=/dev/null -c core.quotePath=false -c core.ignorecase=false \
    check-ignore --no-index "$@"
}
matches=""
while IFS= read -r rule; do
  rule=$(sed -E 's/^[[:space:]]+//; /^#/d; s/[[:space:]]+#.*$//' <<<"$rule")
  # The pattern runs to the first space that isn't escaped.
  pattern=$(sed -E 's/^(([^[:space:]\\]|\\.)+).*$/\1/' <<<"$rule")
  [[ -n $pattern ]] || continue
  who=$(sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' <<<"${rule#"$pattern"}")
  printf '%s\n' "$pattern" >"$tmp/.gitignore"
  while IFS= read -r path; do
    [[ -n $path ]] || continue
    if [[ $pattern == *'/*' ]] && matching -q "$(dirname "$path")"; then continue; fi
    matches+="$path"$'\t'"$who"$'\n'
  done < <(matching --stdin <<<"$paths" || true)
done <<<"$rules"
while IFS= read -r path; do
  [[ -n $path ]] || continue
  who=$(awk -F'\t' -v p="$path" '$1 == p { who = $2 } END { print who }' <<<"$matches")
  [[ -z $who ]] || printf '%s\t%s\n' "$path" "$who"
done <<<"$paths"
