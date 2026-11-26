#!/usr/bin/env bash
# Usage: block.sh <pr> < block.md
#        block.sh <pr> tick "<start of a line's text>" ["<new text>"]
# (run inside the repo)
# The baby-sitting block sits in the PR's body between two lines holding only
# `<!-- baby-sitting -->` and `<!-- /baby-sitting -->`. The first form replaces
# it with stdin, or appends it when the body has none. The second ticks the
# block's `- [ ]` line that starts with that text, and gives it the new text
# when there is one. The rest of the body stays as it is.
#
# BLOCK_MARKER names the markers when another skill keeps the block
# (default: baby-sitting).
set -euo pipefail
pr=$1
export MARKER=${BLOCK_MARKER:-baby-sitting}
body=$(gh pr view "$pr" --json body -q .body)
if [[ ${2:-} == tick ]]; then
  export LINE=$3 TEXT=${4:-}
  new=$(perl -0pe 's{^(<!-- \Q$ENV{MARKER}\E -->\n)(.*?)(^<!-- /\Q$ENV{MARKER}\E -->$)}{
      my ($open, $block, $close) = ($1, $2, $3);
      $block =~ s/^- \[ \] (\Q$ENV{LINE}\E.*)$/"- [x] " . ($ENV{TEXT} ne "" ? $ENV{TEXT} : $1)/me;
      $open . $block . $close }mse' <<<"$body")
  [[ $new != "$body" ]] || { echo "no unticked line starting \"$LINE\" in PR #$pr's $MARKER block" >&2; exit 1; }
else
  BLOCK=$(cat)
  export BLOCK
  new=$(perl -0pe 'BEGIN { $b = "<!-- $ENV{MARKER} -->\n$ENV{BLOCK}\n<!-- /$ENV{MARKER} -->" }
    s/^<!-- \Q$ENV{MARKER}\E -->\n.*?^<!-- \/\Q$ENV{MARKER}\E -->$/$b/ms or $_ = (s/\s+\z//r) . "\n\n$b\n"' <<<"$body")
fi
gh pr edit "$pr" --body-file - <<<"$new" >/dev/null
