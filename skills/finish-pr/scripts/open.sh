#!/usr/bin/env bash
# Usage: open.sh <base> <title> <body-file>  (run in the branch's checkout)
# Pushes the branch and leaves its PR ready for review. With no PR yet, it
# creates one with this title and body. An open PR keeps its title and its
# description, which others may have edited since: only the block between
# `<!-- finish-pr -->` and `<!-- /finish-pr -->` is replaced with the body
# file's, and a draft is marked ready. Prints the PR's number and URL.
set -euo pipefail
base=$1 title=$2 body=$3
dir=$(cd "$(dirname "$0")" && pwd)
[[ -r $body ]] || { echo "no body file at $body" >&2; exit 1; }
"$dir/timer.sh" lap checks-and-description

pushed=$(git push -q -u origin HEAD 2>&1) || { echo "$pushed" >&2; exit 1; }
open=$(gh pr view --json number,state,isDraft -q 'select(.state == "OPEN") | "\(.number) \(.isDraft)"' 2>/dev/null || true)
n=${open%% *}
if [[ -z $n ]]; then
  url=$(gh pr create --base "$base" --title "$title" --body-file "$body")
  n=${url##*/}
else
  block=$(awk '/^<!-- \/finish-pr -->$/ { inside = 0 } inside { print } /^<!-- finish-pr -->$/ { inside = 1 }' "$body")
  [[ -z $block ]] || BLOCK_MARKER=finish-pr "$dir/../../baby-sitting/scripts/block.sh" "$n" <<<"$block"
  [[ ${open##* } != true ]] || gh pr ready "$n" >/dev/null
  url=$(gh pr view "$n" --json url -q .url)
  kept=", its title and description kept"
fi

"$dir/timer.sh" lap push
echo "#$n $url (pushed, ready for review${kept:-})"
