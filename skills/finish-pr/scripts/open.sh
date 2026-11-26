#!/usr/bin/env bash
# Usage: open.sh <base> <title> <body-file>  (run in the branch's checkout)
# Pushes the branch and leaves its PR ready for review with this title and
# body: creates the PR, or updates the open one and takes it out of draft.
# Prints the PR's number and URL.
set -euo pipefail
base=$1 title=$2 body=$3
dir=$(cd "$(dirname "$0")" && pwd)
[[ -r $body ]] || { echo "no body file at $body" >&2; exit 1; }
"$dir/timer.sh" lap ship

pushed=$(git push -q -u origin HEAD 2>&1) || { echo "$pushed" >&2; exit 1; }
n=$(gh pr view --json number,state -q 'select(.state == "OPEN") | .number' 2>/dev/null || true)
if [[ -z $n ]]; then
  url=$(gh pr create --base "$base" --title "$title" --body-file "$body")
  n=${url##*/}
else
  gh pr edit "$n" --title "$title" --body-file "$body" >/dev/null
  gh pr ready "$n" >/dev/null
  url=$(gh pr view "$n" --json url -q .url)
fi

"$dir/timer.sh" lap push
echo "#$n $url (pushed, ready for review)"
