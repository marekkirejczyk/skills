#!/usr/bin/env bash
# Usage: board.sh  (run inside the repo)
# One line per open PR of yours: where it stands and what comes next.
# REVIEW_BOT and REVIEW_BOT_CHECK name the review bot, as in watch.sh.
set -euo pipefail
dir=$(cd "$(dirname "$0")" && pwd)
bot=${REVIEW_BOT:-coderabbit} bot_check=${REVIEW_BOT_CHECK:-CodeRabbit}
printf '| PR | Title | Checks | Review bot | Open threads | Auto-merge | Next |\n|---|---|---|---|---|---|---|\n'
# Joined with a unit separator: `read` folds neighbouring tabs into one, so an
# empty field would shift the rest.
gh pr list --author @me --state open --json number,title,isDraft,autoMergeRequest,mergeable --limit 50 \
  --jq '.[] | [.number, .title, .isDraft, (.autoMergeRequest != null), .mergeable] | map(tostring) | join("\u001f")' |
while IFS=$'\x1f' read -r n title draft automerge mergeable; do
  checks=$(gh pr checks "$n" --json name,state 2>/dev/null || echo '[]')
  review=none
  [[ $bot == none ]] || review=$(jq -r --arg c "$bot_check" '[.[] | select(.name == $c) | .state][0] // "none"' <<<"$checks")
  # The other checks as one word: red if any failed, pending if any is still running.
  ci=$(jq -r --arg c "$bot_check" --arg bot "$bot" '
    [.[] | select($bot == "none" or .name != $c) | .state] as $s
    | if ($s | length) == 0 then "none"
      elif any($s[]; IN("FAILURE", "ERROR", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED")) then "FAILURE"
      elif any($s[]; IN("PENDING", "IN_PROGRESS", "QUEUED", "EXPECTED", "CANCELLED", "STALE")) then "PENDING"
      else "SUCCESS" end' <<<"$checks")
  open=$("$dir/threads.sh" "$n" | wc -l | tr -d ' ')
  if [[ $mergeable == CONFLICTING ]]; then next="rebase"
  elif [[ $ci == FAILURE ]]; then next="fix the checks"
  elif [[ $automerge == true ]]; then next="merges when green and approved"
  elif [[ $draft == true ]]; then next="mark ready"
  elif [[ $open != 0 ]]; then next="pick the bot's comments"
  elif [[ $ci == PENDING ]]; then next="wait for the checks"
  elif [[ $bot != none && $review != SUCCESS && $review != NEUTRAL ]]; then next="wait for the review bot ($review)"
  else next="ready to merge"
  fi
  printf '| #%s | %s | %s | %s | %s | %s | %s |\n' "$n" "${title:0:60}" "$ci" "$review" "$open" "$automerge" "$next"
done
