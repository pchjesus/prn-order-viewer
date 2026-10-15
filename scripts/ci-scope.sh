#!/usr/bin/env bash
# B+ CI v1: conservative scope classification; unknown changes must run FULL.
set -euo pipefail

classify_paths() {
  local path scope=docs count=0
  for path in "$@"; do
    ((count+=1))
    case "$path" in
      *.md|*.mdx|LICENSE|LICENSE.*) ;;
      *.css) [[ "$scope" == docs ]] && scope=focused ;;
      *) scope=full ;;
    esac
    [[ "$scope" == full ]] && break
  done
  if [[ "$count" == 0 ]]; then scope=full; fi
  printf '%s' "$scope"
}

if [[ "${1:-}" == "--self-test" ]]; then
  [[ "$(classify_paths README.md docs/CONTRACT.md)" == docs ]]
  [[ "$(classify_paths styles.css README.md)" == focused ]]
  [[ "$(classify_paths src/ui/styles.css AGENTS.md)" == focused ]]
  [[ "$(classify_paths app.js)" == full ]]
  [[ "$(classify_paths index.html styles.css)" == full ]]
  [[ "$(classify_paths .github/workflows/ci.yml README.md)" == full ]]
  [[ "$(classify_paths)" == full ]]
  echo "PASS: B+ scope classification edge cases"
  exit 0
fi

scope=full
event="${GITHUB_EVENT_NAME:-workflow_dispatch}"
base="${CI_BASE_SHA:-}"

# No implicit scope skipping for manual events or missing/untrusted diff bases.
if [[ "$event" == pull_request || "$event" == push ]]; then
  if [[ "$base" =~ ^[0-9a-fA-F]{40}$ ]] && [[ ! "$base" =~ ^0+$ ]]; then
    if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
      git fetch --no-tags --depth=1 origin "$base" >/dev/null 2>&1 || true
    fi
    if git cat-file -e "$base^{commit}" 2>/dev/null; then
      file_list="$(mktemp)"
      trap 'rm -f "$file_list"' EXIT
      if git diff --name-only -z "$base" HEAD -- > "$file_list"; then
        files=()
        while IFS= read -r -d '' file; do files+=("$file"); done < "$file_list"
        scope="$(classify_paths "${files[@]}")"
        # Every executable change on main gets FULL verification.
        if [[ "$event" != pull_request && "$scope" == focused ]]; then scope=full; fi
      fi
    fi
  fi
fi

echo "B+ scope: $scope (event: $event, base: ${base:-none})"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'tier=%s\n' "$scope" >> "$GITHUB_OUTPUT"
fi
