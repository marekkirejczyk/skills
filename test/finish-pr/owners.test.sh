#!/usr/bin/env bash
# Usage: test/finish-pr/owners.test.sh
# Checks which changed files finish-pr's owners.sh gives a code owner, for the
# places CODEOWNERS and .gitignore matching differ. Needs bash and git.
set -uo pipefail
owners="$(cd "$(dirname "$0")/../.." && pwd)/skills/finish-pr/scripts/owners.sh"
rules=$(mktemp)
failed=0

cat >"$rules" <<'RULES'
# Everything has a default owner; later rules win.
*                     @default
/docs/                @writers
/docs/internal/       # nobody: an owner-less rule clears the owners
/src/payments/        @payments @security   # two owners, and a comment
/src/*                @src-top
*.sql                 @data
/src/payments/README.md @writers
/config/app.*         @platform
   /indented/         @indented
/my\ dir/             @spaced
/Assets/              @design
RULES

# expect <path> <owners, or - for none>
expect() {
  local got
  got=$(printf '%s\n' "$1" | "$owners" "$rules" | cut -f2)
  if [[ ${got:--} == "$2" ]]; then echo "ok   $1 -> $2"; else echo "FAIL $1: wanted \"$2\", got \"${got:--}\""; failed=1; fi
}

expect "README.md"                   "@default"
expect "docs/guide.md"               "@writers"
expect "docs/deep/nested/page.md"    "@writers"
expect "docs/internal/notes.md"      "-"
expect "src/payments/charge.ts"      "@payments @security"
expect "src/payments/README.md"      "@writers"
expect "src/main.ts"                 "@src-top"
expect "src/util/dates.ts"           "@default"
expect "db/migrations/0001_init.sql" "@data"
expect "src/payments/schema.sql"     "@data"
expect "config/app.yaml"             "@platform"
expect "config/other.yaml"           "@default"
expect "indented/file.txt"           "@indented"
expect "my dir/file.txt"             "@spaced"
expect "docs/café.md"                "@writers"
# Case counts, as on GitHub, whatever the file system.
expect "Assets/logo.svg"             "@design"
expect "assets/logo.svg"             "@default"

# Several paths at once keep their order, and a file with no owner is left out.
got=$(printf '%s\n' docs/internal/notes.md src/main.ts README.md | "$owners" "$rules")
want=$(printf 'src/main.ts\t@src-top\nREADME.md\t@default')
if [[ $got == "$want" ]]; then echo "ok   several paths"; else echo "FAIL several paths: got \"$got\""; failed=1; fi

# No path at all: nothing printed, and no complaint.
got=$("$owners" "$rules" </dev/null 2>&1)
if [[ -z $got ]]; then echo "ok   no paths"; else echo "FAIL no paths: got \"$got\""; failed=1; fi

# The developer's own ignore file is not a rule: a path it ignores has only
# the owners CODEOWNERS gives it.
home=$(mktemp -d)
mkdir -p "$home/git"
printf '*.log\n.vscode/\n' >"$home/git/ignore"
printf '/src/payments/ @payments\n' >"$rules"
export XDG_CONFIG_HOME=$home
expect "build/out.log"         "-"
expect ".vscode/settings.json" "-"
expect "src/payments/out.log"  "@payments"

# No rule at all: nothing has an owner.
: >"$rules"
expect "README.md" "-"
exit $failed
