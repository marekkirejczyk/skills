#!/usr/bin/env bash
# Lines of code for the "project in numbers" slide. Run from the repo root.
# Counts git-tracked files only (cloc: code lines, no blanks or comments).
# Prints: all languages; production vs tests; production lines per package.
# Extra exclusions: LOC_EXCLUDE='regex' (added to the defaults below).
set -euo pipefail
command -v cloc >/dev/null || { echo "cloc not found (brew install cloc / apt install cloc)" >&2; exit 1; }

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
. "$(dirname "$0")/filters.sh"

git ls-files | grep -Ev "$ex" > "$tmp/all"
grep -Ev "$test_re|$fixture_re" "$tmp/all" > "$tmp/prod" || true
grep -E "$test_re" "$tmp/all" | grep -Ev "$fixture_re" > "$tmp/test" || true

echo "== Commit: $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)"
echo "== Excluded (generated/vendored): $(git ls-files | grep -Ec "$ex" || true) files"
echo
echo "== All tracked files by language"
cloc --list-file="$tmp/all" --quiet --hide-rate | sed '/^$/d'
echo
echo "== Production (no tests, no fixtures)"
cloc --list-file="$tmp/prod" --quiet --hide-rate | sed '/^$/d'
echo
echo "== Tests"
cloc --list-file="$tmp/test" --quiet --hide-rate | sed '/^$/d'
echo
echo "== Production code lines per package (first two path segments for apps/ packages/ libs/ services/ crates/ skills/ plugins/, else first)"
grep -E "$code_ext" "$tmp/prod" | awk -F/ "$pkg_awk" | sort -u | while read -r pkg; do
  if [ "$pkg" = "(root)" ]; then grep -E "$code_ext" "$tmp/prod" | grep -v / > "$tmp/pkg" || true
  else grep -E "$code_ext" "$tmp/prod" | grep -E "^$pkg/" > "$tmp/pkg" || true; fi
  [ -s "$tmp/pkg" ] || continue
  n=$(cloc --list-file="$tmp/pkg" --quiet --csv 2>/dev/null | awk -F, '$2=="SUM"{print $5}')
  printf '%7s  %s\n' "${n:-0}" "$pkg"
done | sort -rn
