#!/usr/bin/env bash
# Installer for the nocta-execute Claude Code skill.
# Run from inside the cloned repo:  bash install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
LINK="$SKILLS_DIR/nocta-execute"

echo "==> Installing nocta-execute from $REPO_DIR"

# 1. Dependencies (Playwright). Uses your installed Google Chrome - no extra
#    browser download.
command -v node >/dev/null 2>&1 || { echo "Node.js 18+ is required. Install it first."; exit 1; }
echo "==> Installing dependencies (playwright)"
( cd "$REPO_DIR" && npm install --no-audit --no-fund )

# 2. Make the skill visible to Claude Code by symlinking it into the skills dir.
mkdir -p "$SKILLS_DIR"
if [ -e "$LINK" ] && [ ! -L "$LINK" ]; then
  echo "!! $LINK already exists and is not a symlink. Move it aside and re-run."
  exit 1
fi
ln -sfn "$REPO_DIR/skill/nocta-execute" "$LINK"
echo "==> Linked skill: $LINK -> $REPO_DIR/skill/nocta-execute"

# 3. Put the `agent-browser` command on your PATH (best effort; the skill also
#    works by calling the script directly).
if npm link >/dev/null 2>&1; then
  echo "==> 'agent-browser' is on your PATH (via npm link)"
else
  echo "==> Skipped global 'agent-browser' link (no permission). The skill will call"
  echo "    node $LINK/bin/agent-browser.mjs directly, which also works."
fi

echo
echo "Done. Open Claude Code and run:  /nocta-execute open a task, e.g. \"search Hacker News for playwright and give me the top 3 titles\""
echo "First run per site: log in inside the Chrome window that opens - the profile is remembered afterwards."
