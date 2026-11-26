#!/usr/bin/env bash
# Usage: test/baby-sitting/watch.test.sh
# Checks the event baby-sitting's watch.sh reports for a set of PR states.
# Needs bash and jq; calls nothing on GitHub.
set -uo pipefail
watch="$(cd "$(dirname "$0")/../.." && pwd)/skills/baby-sitting/scripts/watch.sh"
fixture=$(mktemp)
failed=0

check='{"__typename":"CheckRun","name":"test","status":"COMPLETED","conclusion":"SUCCESS"}'
deploy='{"__typename":"StatusContext","context":"deploy/preview","state":"SUCCESS"}'
running='{"__typename":"CheckRun","name":"test","status":"IN_PROGRESS","conclusion":null}'
failing='{"__typename":"CheckRun","name":"test","status":"COMPLETED","conclusion":"FAILURE"}'
cancelled='{"__typename":"CheckRun","name":"test","status":"COMPLETED","conclusion":"CANCELLED"}'
dropped='{"__typename":"CheckRun","name":"CodeRabbit","status":"COMPLETED","conclusion":"CANCELLED"}'
neutral='{"__typename":"CheckRun","name":"CodeRabbit","status":"COMPLETED","conclusion":"NEUTRAL"}'
reviewed='{"__typename":"CheckRun","name":"CodeRabbit","status":"COMPLETED","conclusion":"SUCCESS"}'
reviewing='{"__typename":"CheckRun","name":"CodeRabbit","status":"IN_PROGRESS","conclusion":null}'
skipped='{"__typename":"CheckRun","name":"CodeRabbit","status":"COMPLETED","conclusion":"SKIPPED"}'
other_reviewed='{"__typename":"CheckRun","name":"Review Robot","status":"COMPLETED","conclusion":"SUCCESS"}'
rabbit='{"nodes":[{"author":{"login":"coderabbitai"}}]}'
robot='{"nodes":[{"author":{"login":"review-robot"}}]}'
human='{"nodes":[{"author":{"login":"a-developer"}}]}'
ghost='{"nodes":[{"author":null}]}'
# One thread waiting for an answer, one we answered, one resolved, one by a deleted account.
threads="[{\"isResolved\":false,\"first\":$rabbit,\"last\":$rabbit},{\"isResolved\":false,\"first\":$rabbit,\"last\":$human},
  {\"isResolved\":true,\"first\":$rabbit,\"last\":$rabbit},{\"isResolved\":false,\"first\":$ghost,\"last\":$ghost}]"
robot_threads="[{\"isResolved\":false,\"first\":$robot,\"last\":$robot},{\"isResolved\":false,\"first\":$robot,\"last\":$robot}]"
on='{"enabledAt":"2026-01-01T00:00:00Z"}'

# expect <event> <mode> <--ready|-> <waited> <state> <mergeable> <reviewDecision> <autoMerge> <checks> <threads> [behind] [mergeStateStatus]
expect() {
  local want=$1 mode=$2 after=$3 waited=$4
  jq -n --arg s "$5" --arg m "$6" --arg r "$7" --argjson a "$8" --argjson c "[$9]" --argjson t "${10}" \
    --argjson b "${11:-0}" --arg ms "${12:-CLEAN}" \
    '{data:{repository:{pullRequest:{state:$s,mergeable:$m,mergeStateStatus:$ms,reviewDecision:$r,autoMergeRequest:$a,
      mergedBy:{login:"a-developer"},headRef:{compare:{aheadBy:$b}},
      commits:{nodes:[{commit:{statusCheckRollup:{contexts:{nodes:$c}}}}]},reviewThreads:{nodes:$t}}}}}' >"$fixture"
  [[ $after == - ]] && after=""
  local got
  # shellcheck disable=SC2086
  got=$(WATCH_FIXTURE=$fixture WATCH_WAITED=$waited "$watch" 0 "$mode" $after)
  if [[ $got == "$want" ]]; then echo "ok   ${want:-(keep waiting)}"; else echo "FAIL wanted \"$want\", got \"$got\""; failed=1; fi
}

# Manual mode, CodeRabbit as the review bot.
expect "ready"                 manual -       30  OPEN MERGEABLE REVIEW_REQUIRED null "$check,$deploy,$reviewed" '[]'
expect "threads 1"             manual -       30  OPEN MERGEABLE "" null "$check,$reviewed" "$threads"
expect "threads 1"             manual -       30  OPEN MERGEABLE "" null "$running,$reviewed" "$threads"
expect ""                      manual -       30  OPEN MERGEABLE "" null "$check,$reviewing" "$threads"
expect ""                      manual -       30  OPEN MERGEABLE "" null "$check,$skipped" '[]'
expect "unreviewed"            manual -       200 OPEN MERGEABLE "" null "$check,$skipped" '[]'
expect ""                      manual --ready 30  OPEN MERGEABLE "" null "$check,$reviewed" '[]'
expect "threads 1"             manual --ready 30  OPEN MERGEABLE "" null "$check,$reviewed" "$threads"
expect "red test"              manual -       30  OPEN MERGEABLE "" null "$failing,$reviewed" '[]'
expect "conflict"              manual --ready 30  OPEN CONFLICTING "" null "$check,$reviewed" '[]'
expect "auto-merge-on"         manual -       30  OPEN MERGEABLE "" "$on" "$running,$reviewing" '[]'
expect "auto-merge-on"         manual -       30  OPEN MERGEABLE "" "$on" "$failing,$reviewed" '[]'
expect "auto-merge-on"         manual --ready 30  OPEN CONFLICTING "" "$on" "$check,$reviewed" '[]'
expect "unreviewed"            manual -       200 OPEN MERGEABLE "" null "$check,$dropped" '[]'
expect "ready"                 manual -       30  OPEN MERGEABLE "" null "$check,$neutral" '[]'
expect ""                      manual -       200 OPEN MERGEABLE "" null "$cancelled,$reviewed" '[]'
# No check but the bot's: waited on at first, then taken as a repository without CI.
expect ""                      manual -       30  OPEN MERGEABLE "" null "$reviewed" '[]'
expect "ready"                 manual -       200 OPEN MERGEABLE "" null "$reviewed" '[]'
expect ""                      manual -       5   OPEN UNKNOWN "" null "" '[]'
expect "unreviewed"            manual -       200 OPEN MERGEABLE "" null "" '[]'
expect "behind 2"              manual -       30  OPEN MERGEABLE "" null "$check,$reviewed" '[]' 2
expect "behind 2"              manual --ready 30  OPEN MERGEABLE "" null "$check,$reviewed" '[]' 2
expect ""                      manual -       30  OPEN MERGEABLE "" null "$running,$reviewed" '[]' 2
expect "threads 1"             manual -       30  OPEN MERGEABLE "" null "$check,$reviewed" "$threads" 2
expect "closed"                manual -       30  CLOSED UNKNOWN "" null "$check" '[]'

# Auto mode.
expect "merged by a-developer" auto   --ready 30  MERGED UNKNOWN "" null "$check,$reviewed" '[]'
expect "auto-merge-off"        auto   -       30  OPEN MERGEABLE "" null "$running,$reviewing" '[]'
expect ""                      auto   -       30  OPEN MERGEABLE REVIEW_REQUIRED "$on" "$running,$reviewing" "$threads"
expect "review-needed"         auto   -       30  OPEN MERGEABLE REVIEW_REQUIRED "$on" "$check,$reviewing" "$threads"
expect ""                      auto   --ready 30  OPEN MERGEABLE REVIEW_REQUIRED "$on" "$check,$reviewing" "$threads"
expect ""                      auto   -       30  OPEN MERGEABLE APPROVED "$on" "$check,$reviewed" '[]'
# Behind the base matters to auto mode only when GitHub won't merge without it.
expect ""                      auto   -       30  OPEN MERGEABLE APPROVED "$on" "$check,$reviewed" '[]' 2
expect "behind 2"              auto   -       30  OPEN MERGEABLE APPROVED "$on" "$check,$reviewed" '[]' 2 BEHIND

# Another review bot, named by the environment: CodeRabbit's threads and check are nobody's.
export REVIEW_BOT=review-robot REVIEW_BOT_CHECK="Review Robot"
expect "threads 2"             manual -       30  OPEN MERGEABLE "" null "$check,$other_reviewed" "$robot_threads"
expect "ready"                 manual -       30  OPEN MERGEABLE "" null "$check,$other_reviewed" "$threads"
expect "unreviewed"            manual -       200 OPEN MERGEABLE "" null "$check,$reviewed" '[]'

# No review bot: green is ready, and a bot's threads are left alone.
export REVIEW_BOT=none
unset REVIEW_BOT_CHECK
expect "ready"                 manual -       200 OPEN MERGEABLE "" null "$check" "$threads"
expect ""                      manual -       200 OPEN MERGEABLE "" null "$running" '[]'
expect ""                      manual -       30  OPEN MERGEABLE "" null "" '[]'
expect "ready"                 manual -       200 OPEN MERGEABLE "" null "" '[]'
exit $failed
