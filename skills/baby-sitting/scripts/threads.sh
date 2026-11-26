#!/usr/bin/env bash
# Usage: threads.sh <pr>  (run inside the repo)
# Prints the review bot's threads on the PR that still need an answer:
# unresolved, and the bot spoke last. One JSON object per line. `body` is the
# bot's finding; `reply` is its latest answer, when it has answered one of
# ours. Reads every page of threads, and each thread's first and last comment,
# however many lie between.
#
# The bot is CodeRabbit unless REVIEW_BOT holds another pattern its login
# matches. REVIEW_BOT=none prints nothing.
set -euo pipefail
pr=$1
bot=${REVIEW_BOT:-coderabbit}
[[ $bot != none ]] || exit 0
gh api graphql --paginate -F owner='{owner}' -F name='{repo}' -F n="$pr" -f query='
query($owner:String!,$name:String!,$n:Int!,$endCursor:String){repository(owner:$owner,name:$name){pullRequest(number:$n){
  reviewThreads(first:100,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{id isResolved isOutdated path line
    first:comments(first:1){nodes{databaseId author{login} body url}}
    last:comments(last:1){nodes{databaseId author{login} body}}}}}}}' |
  jq -c --arg bot "$bot" '.data.repository.pullRequest.reviewThreads.nodes[]
    | select(.isResolved|not)
    | .first.nodes[0] as $first | .last.nodes[0] as $last
    | select($first.author.login // "" | test($bot; "i"))
    | select($last.author.login // "" | test($bot; "i"))
    | {thread:.id, comment:$first.databaseId, path, line, outdated:.isOutdated, url:$first.url, body:$first.body,
       reply:(if $last.databaseId != $first.databaseId then $last.body else null end)}'
