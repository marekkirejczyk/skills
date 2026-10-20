# Shared path rules for loc.sh and pr-stats.sh (sourced, not run).
# Generated or vendored files that would drown the real code.
default_ex='(^|/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|Cargo\.lock|poetry\.lock|uv\.lock|go\.sum|composer\.lock)$|(^|/)(vendor|dist|build|node_modules)/|/meta/.*snapshot\.json$|\.min\.(js|css)$|\.snap$'
ex="$default_ex${LOC_EXCLUDE:+|$LOC_EXCLUDE}"
test_re='(^|/)(test|tests|__tests__|spec|e2e)/|\.(test|spec)\.[a-z]+$|_test\.(go|py)$|(^|/)test_[^/]*\.py$'
fixture_re='(^|/)(fixtures?|__fixtures__|testdata)/'
code_ext='\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|rb|php|cs|c|cc|cpp|h|hpp|vue|svelte|css|scss|sql|sh|bash)$'
# Path -> package: first two segments under these folders, else the first segment, else (root).
pkg_awk='{ if ($1 ~ /^(apps|packages|libs|services|crates|modules|skills|plugins)$/ && NF > 2) print $1"/"$2; else if (NF > 1) print $1; else print "(root)" }'
