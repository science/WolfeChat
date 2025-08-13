#!/usr/bin/env bash
set -euo pipefail

# Roll back working tree changes to the last local commit (HEAD).
# - Discards staged and unstaged changes to tracked files.
# - Deletes untracked files and directories (excluding ignored files).
# - Keeps all local commits intact. Does NOT sync to remote.

# Ensure we're inside a git repository
git rev-parse --is-inside-work-tree >/dev/null

echo "Resetting tracked files to last commit (HEAD)..."
git reset --hard HEAD

echo "Removing untracked files and directories (excluding ignored files)..."
git clean -fd

echo "Rollback complete."
