#!/usr/bin/env bash
# Usage: timer.sh start | lap <phase> | report
# Times /finish-pr's phases, so a slow one shows. `lap <phase>` closes the
# phase that just ended, once: a second lap of the same name is ignored. The
# laps live in this checkout's git directory and are never committed.
set -euo pipefail
file="$(git rev-parse --absolute-git-dir)/finish-pr-laps"
case ${1:-} in
  start) printf '%s start\n' "$(date +%s)" >"$file" ;;
  lap) grep -q " $2\$" "$file" 2>/dev/null || printf '%s %s\n' "$(date +%s)" "$2" >>"$file" ;;
  report)
    [[ -f $file ]] || exit 0
    awk 'NR == 1 { first = prev = $1; next }
      { printf "%s%s %ds", sep, $2, $1 - prev; sep = " | "; prev = $1 }
      END { if (NR > 1) printf " | total %ds\n", prev - first }' "$file"
    ;;
  *) echo "usage: timer.sh start | lap <phase> | report" >&2; exit 2 ;;
esac
