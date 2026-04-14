#!/usr/bin/env bash
# Reads .fork-keep-deleted and git-removes any listed files that exist on disk.
# Run after `git merge upstream/main` to auto-stage upstream files we've dropped.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="$REPO_ROOT/.fork-keep-deleted"

if [[ ! -f "$REGISTRY" ]]; then
  echo "ERROR: $REGISTRY not found" >&2
  exit 1
fi

removed=0

while IFS= read -r line; do
  # Skip comments and blank lines
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue

  path="$REPO_ROOT/$line"
  if [[ -e "$path" ]]; then
    git -C "$REPO_ROOT" rm -- "$line"
    echo "Removed: $line"
    ((removed++)) || true
  fi
done < "$REGISTRY"

if [[ $removed -eq 0 ]]; then
  echo "Nothing to remove."
fi
