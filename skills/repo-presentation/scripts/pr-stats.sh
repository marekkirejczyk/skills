#!/usr/bin/env bash
# Change statistics for a PR deck ("what changed" slide). Run from the repo root.
# Usage: bash pr-stats.sh <base-ref> [head-ref]   (head defaults to HEAD)
# Compares merge-base(base, head)..head, the same diff a PR shows.
# Prints: commits; files by status; lines added/removed for production, tests, fixtures;
# production lines per package; every changed file with status and +/-.
# Extra exclusions: LOC_EXCLUDE='regex' (added to the defaults in filters.sh).
set -euo pipefail
base=${1:?usage: bash pr-stats.sh <base-ref> [head-ref]}
head=${2:-HEAD}
. "$(dirname "$0")/filters.sh"
mb=$(git merge-base "$base" "$head")
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# numstat without rename detection: one path per line; binary files show "-".
git diff --numstat --no-renames "$mb" "$head" | awk -F'\t' '{ a=($1=="-")?0:$1; d=($2=="-")?0:$2; print a"\t"d"\t"$3 }' > "$tmp/num"
awk -F'\t' '{ print $3 }' "$tmp/num" | grep -Ev "$ex" > "$tmp/keptnames" || true
awk -F'\t' 'NR==FNR { keep[$0]=1; next } ($3 in keep)' "$tmp/keptnames" "$tmp/num" > "$tmp/kept"
kind() { if grep -Eq "$fixture_re" <<<"$1"; then echo fixtures; elif grep -Eq "$test_re" <<<"$1"; then echo tests; else echo production; fi; }
while IFS=$'\t' read -r a d f; do printf '%s\t%s\t%s\t%s\n' "$a" "$d" "$f" "$(kind "$f")"; done < "$tmp/kept" > "$tmp/k"

echo "== $(git rev-parse --short "$mb") (merge-base with $base) .. $(git rev-parse --short "$head") ($head)"
echo "== Commits: $(git rev-list --count "$mb..$head")"
git log --format='   %h %s' "$mb..$head" | head -20
echo
echo "== Files by status (A added, M modified, D deleted, R renamed)"
git diff --name-status -M "$mb" "$head" | awk '{ print substr($1,1,1) }' | sort | uniq -c | awk '{ printf "%5s %s\n", $1, $2 }'
echo "   excluded as generated/vendored: $(( $(wc -l < "$tmp/num") - $(wc -l < "$tmp/kept") )) files"
echo
echo "== Lines added / removed"
for k in production tests fixtures; do
  awk -F'\t' -v k="$k" '$4==k { a+=$1; d+=$2; n++ } END { printf "%-11s %4d files  +%-6d -%d\n", k, n, a, d }' "$tmp/k"
done
echo
echo "== Production lines per package (code files only)"
awk -F'\t' '$4=="production"' "$tmp/k" | while IFS=$'\t' read -r a d f _; do
  grep -Eq "$code_ext" <<<"$f" && printf '%s\t%s\t%s\n' "$a" "$d" "$(awk -F/ "$pkg_awk" <<<"$f")"
done > "$tmp/pkgs" || true
awk -F'\t' '{ a[$3]+=$1; d[$3]+=$2 } END { for (p in a) printf "%d\t+%-6d -%-6d %s\n", a[p]+d[p], a[p], d[p], p }' "$tmp/pkgs" | sort -rn | cut -f2-
echo
echo "== Changed files"
git diff --name-status -M "$mb" "$head" | while IFS=$'\t' read -r st p1 p2; do
  f=${p2:-$p1}
  line=$(awk -F'\t' -v f="$f" '$3==f { printf "+%d -%d", $1, $2 }' "$tmp/num")
  grep -Eq "$ex" <<<"$f" && gen='  [generated, not counted]' || gen=''
  printf '%-2s %-14s %s%s%s\n' "${st:0:1}" "${line:-binary}" "$f" "${p2:+  (from $p1)}" "$gen"
done
