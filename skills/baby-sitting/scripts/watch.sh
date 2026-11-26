#!/usr/bin/env bash
# Usage: watch.sh <pr> <manual|auto> [--ready]  (run inside the repo)
# Polls the PR every 20 seconds, with one GraphQL request, and exits as soon
# as something needs the agent. Line 1 is the event and how long it took,
# line 2 every check and its state.
#
#   merged by <login> | closed
#   conflict         the branch no longer merges into its base
#   red <checks>     these checks failed
#   auto-merge-on    manual: someone turned GitHub auto-merge on
#   threads <n>      manual: the review bot has reviewed, n threads wait for an answer
#   behind <n>       the base has n commits the branch lacks. manual: once the
#                    checks are done; auto: only when GitHub won't merge without them
#   ready            manual: green, the bot has reviewed, nothing to answer
#   unreviewed       manual: green, but the bot has not reviewed
#   review-needed    auto: green, and waiting for an approval
#   auto-merge-off   auto: GitHub auto-merge is not on
#   error <why>      GitHub could not be read three times running
#   timeout          none of these within the limit
#
# --ready: `ready` or `review-needed` was already reported. Keeps watching for
# the other events, for 4 hours rather than 30 minutes.
#
# The review bot is CodeRabbit unless the environment says otherwise:
#   REVIEW_BOT        a pattern its login matches (default: coderabbit), or
#                     `none` for a repository with no review bot
#   REVIEW_BOT_CHECK  the name of its check on the PR (default: CodeRabbit)
set -uo pipefail
pr=$1 mode=${2:-manual} after=${3:-}
bot=${REVIEW_BOT:-coderabbit} bot_check=${REVIEW_BOT_CHECK:-CodeRabbit}
limit=1800
ready=false
[[ $after == --ready ]] && limit=14400 && ready=true
# Checks and a review bot start within seconds of a push. What is still
# missing after this long is not coming on its own.
grace=180

query='query($owner:String!,$name:String!,$n:Int!,$base:String!){repository(owner:$owner,name:$name){pullRequest(number:$n){
  state mergeable mergeStateStatus reviewDecision autoMergeRequest{enabledAt} mergedBy{login}
  headRef{compare(headRef:$base){aheadBy}}
  commits(last:1){nodes{commit{statusCheckRollup{contexts(first:100){nodes{__typename
    ... on CheckRun{name status conclusion}
    ... on StatusContext{context state}}}}}}}
  reviewThreads(last:100){nodes{isResolved
    first:comments(first:1){nodes{author{login}}} last:comments(last:1){nodes{author{login}}}}}}}}'

# Prints the event, or an empty line while there is only waiting to do, then
# the checks. Green means every check but the bot's has finished and none was
# cancelled: a cancelled run is being replaced. No check at all is waited on
# for the grace period, then taken as a repository without CI. The bot
# has reviewed only when its check succeeded or ended neutral. The threads are
# the PR's newest 100, to keep each poll to one request.
# In manual mode auto-merge comes before a conflict or a red check, so it is
# off before any fix is pushed. `behind` waits for the checks to finish, so a
# rebase never cuts a run short, and comes after `threads`, so the developer's
# pick and the rebase go out as one push.
decide='
  .data.repository.pullRequest as $p
  | ($bot != "none") as $has_bot
  | [$p.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[]?
      | if .__typename == "CheckRun"
        then {name, state: (if .status != "COMPLETED" then "PENDING" else .conclusion end)}
        else {name: .context, state} end] as $all
  | ($all | map(select($has_bot and .name == $bot_check | not))) as $checks
  | (if $has_bot then ($all | map(select(.name == $bot_check)) | .[0].state // "NONE") else "SUCCESS" end) as $review
  | ($checks | map(select(.state | IN("FAILURE", "ERROR", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED")) | .name)) as $red
  | ((($checks | length) == 0 and $waited < $grace)
      or ($checks | any(.state | IN("PENDING", "EXPECTED", "QUEUED", "CANCELLED", "STALE")))) as $pending
  | ([$p.reviewThreads.nodes[]
      | select($has_bot)
      | select(.isResolved | not)
      | select(.first.nodes[0].author.login // "" | test($bot; "i"))
      | select(.last.nodes[0].author.login // "" | test($bot; "i"))] | length) as $threads
  | ($review | IN("SUCCESS", "NEUTRAL", "PENDING") | not) as $unreviewed
  | ($p.headRef.compare.aheadBy // 0) as $behind
  | (if $p.state == "MERGED" then "merged by \($p.mergedBy.login // "someone")"
     elif $p.state == "CLOSED" then "closed"
     elif $mode == "manual" and $p.autoMergeRequest != null then "auto-merge-on"
     elif $p.mergeable == "CONFLICTING" then "conflict"
     elif ($red | length) > 0 then "red " + ($red | join(", "))
     elif $mode == "manual" then
       if $review != "PENDING" and $threads > 0 then "threads \($threads)"
       elif $pending or $review == "PENDING" then ""
       elif $behind > 0 then "behind \($behind)"
       elif $ready or ($unreviewed and $waited < $grace) then ""
       elif $unreviewed then "unreviewed" else "ready" end
     elif $p.autoMergeRequest == null then "auto-merge-off"
     elif $p.mergeStateStatus == "BEHIND" and $behind > 0 then "behind \($behind)"
     elif $ready or $pending then ""
     elif $p.reviewDecision == "REVIEW_REQUIRED" or $p.reviewDecision == "CHANGES_REQUESTED" then "review-needed"
     else "" end) as $event
  | $event, ($all | map("\(.name)=\(.state)") | join(" "))'

decide() {
  jq -r --arg mode "$mode" --arg bot "$bot" --arg bot_check "$bot_check" --argjson ready "$ready" \
    --argjson waited "$1" --argjson grace "$grace" "$decide" "${@:2}"
}

# With a fixture file, decide once and print the event: the test uses it.
if [[ -n ${WATCH_FIXTURE:-} ]]; then
  decide "${WATCH_WAITED:-0}" "$WATCH_FIXTURE" | sed -n 1p
  exit 0
fi

checks="" failures=0 raw="" out=""
base=$(gh pr view "$pr" --json baseRefName -q .baseRefName) || { echo "error PR #$pr could not be read (after 0s)"; exit 1; }
while ((SECONDS < limit)); do
  out=""
  if raw=$(gh api graphql -F owner='{owner}' -F name='{repo}' -F n="$pr" -F base="$base" -f query="$query" 2>&1) &&
    out=$(decide "$SECONDS" <<<"$raw" 2>&1); then
    failures=0
    event=$(sed -n 1p <<<"$out")
    checks=$(sed -n 2p <<<"$out")
    if [[ -n $event ]]; then
      printf '%s (after %ds)\n%s\n' "$event" "$SECONDS" "$checks"
      exit 0
    fi
  elif ((++failures == 3)); then
    printf 'error %s (after %ds)\n%s\n' "$(tail -n 1 <<<"${out:-$raw}" | cut -c1-200)" "$SECONDS" "$checks"
    exit 1
  fi
  sleep 20
done
printf 'timeout (after %ds)\n%s\n' "$SECONDS" "$checks"
