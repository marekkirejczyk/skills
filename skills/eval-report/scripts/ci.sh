#!/usr/bin/env bash
# CI entry point, after the evals have run. Builds the report, publishes it to
# GitHub Pages, links it on the PR (one comment, and a block at the top of the
# description) and writes the job summary. No model calls.
#   ci.sh <results.json> [more eval-report options, e.g. --adapter file]
# Env: GH_TOKEN (pull-requests: write, contents: write), EVAL_REPORT_SHA (the PR head),
# EVAL_REPORT_COMMENT=false to skip the PR comment and description block.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${EVAL_REPORT_DIR:-eval-report}
mkdir -p "$out"

event() { node -e 'const p = process.env.GITHUB_EVENT_PATH; const e = p ? require(p) : {}; const pr = e.pull_request; process.stdout.write(String(eval(process.argv[1]) ?? ""))' "$1"; }
pr=$(event 'pr ? pr.number : ""')
same_repo=$(event 'pr ? pr.head.repo.full_name === process.env.GITHUB_REPOSITORY : false')
sha=${EVAL_REPORT_SHA:-${GITHUB_SHA:-}}

scope=()
if [ -n "$pr" ]; then scope=(--scope pr); fi
report() { node "$here/eval-report.mjs" "$@" ${scope[@]+"${scope[@]}"}; }

report "$@" --out "$out/index.html"

url=""
if [ -n "$pr" ] && [ "$same_repo" = true ]; then
  if site=$(bash "$here/publish-pages.sh" "$out/index.html" "eval-reports/pr-$pr"); then
    url="$site?v=${sha:0:7}"   # a new query per commit gets past the Pages cache
  else
    echo "::warning::Could not publish the report to gh-pages; it is still in the job's artifacts."
  fi
fi

report "$@" --summary "$out/summary.md" --headline "$out/headline.md" ${url:+--report-url "$url"}
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$out/summary.md" >> "$GITHUB_STEP_SUMMARY"; fi

if [ -n "$pr" ] && [ "$same_repo" = true ] && [ "${EVAL_REPORT_COMMENT:-true}" != false ]; then
  node "$here/publish-pr.mjs" --pr "$pr" --summary "$out/summary.md" --headline "$out/headline.md"
fi
if [ -n "$url" ]; then echo "Report: $url"; fi
