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
tmp=$(mktemp -d)
trap '[[ -n $tmp ]] && rm -rf "$tmp"' EXIT
git init -q "$tmp"
matches=""
while IFS= read -r rule; do
  [[ $rule != \#* ]] || continue
  rule=$(sed -E 's/[[:space:]]+#.*$//' <<<"$rule")
  pattern=${rule%%[[:space:]]*}
  [[ -n $pattern ]] || continue
  who=$(awk '{ $1 = ""; sub(/^ /, ""); print }' <<<"$rule")
  printf '%s\n' "$pattern" >"$tmp/.gitignore"
  while IFS= read -r path; do
    [[ -n $path ]] || continue
    if [[ $pattern == *'/*' ]] && git -C "$tmp" check-ignore -q --no-index "$(dirname "$path")"; then continue; fi
    matches+="$path"$'\t'"$who"$'\n'
  done < <(git -C "$tmp" check-ignore --no-index --stdin <<<"$paths" || true)
done <<<"$rules"
while IFS= read -r path; do
  [[ -n $path ]] || continue
  who=$(awk -F'\t' -v p="$path" '$1 == p { who = $2 } END { print who }' <<<"$matches")
  [[ -z $who ]] || printf '%s\t%s\n' "$path" "$who"
done <<<"$paths"
