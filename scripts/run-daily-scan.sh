#!/usr/bin/env bash
set -euo pipefail

# career-ops daily job scan — launchd entry point
# Runs the Claude Desktop scheduled-task prompt (career-ops-daily-scan) headless
# via claude -p, exactly the batch-runner.sh pattern (see AGENTS.md Headless /
# Batch Mode). Replaces reliance on Claude Desktop's internal scheduler, which
# silently stopped firing on 2026-08-13. launchd fires this once a day via
# ~/Library/LaunchAgents/io.career-ops.daily-scan.plist (StartCalendarInterval
# mirrors config/profile.yml automation.daily_scan_time, currently 06:00).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOGS_DIR="$PROJECT_DIR/data/logs"
LOG_FILE="$LOGS_DIR/daily-scan.log"
LOCK_FILE="$LOGS_DIR/daily-scan.lock"
PROMPT_FILE="/Users/madams/.claude/scheduled-tasks/career-ops-daily-scan/SKILL.md"
CLAUDE_BIN="/Users/madams/.local/bin/claude"
PROFILE_FILE="$PROJECT_DIR/config/profile.yml"
MAIN_PID="${BASHPID:-$$}"

mkdir -p "$LOGS_DIR"
cd "$PROJECT_DIR"

# Simple PID lock so overlapping runs can't stack (same idea as batch-runner.sh's
# LOCK_FILE — a job that missed its window isn't worth running twice at once).
acquire_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    local old_pid
    old_pid=$(cat "$LOCK_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ERROR: another daily scan is already running (PID $old_pid) — exiting." >> "$LOG_FILE"
      exit 1
    else
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARN: stale lock file found (PID $old_pid not running). Removing." >> "$LOG_FILE"
      rm -f "$LOCK_FILE"
    fi
  fi
  echo "$MAIN_PID" > "$LOCK_FILE"
}

release_lock() {
  rm -f "$LOCK_FILE"
}
trap release_lock EXIT

# Read automation.daily_scan_time from config/profile.yml — for logging/sanity
# only, not required by this script's logic (the trigger time lives in the
# plist's StartCalendarInterval). Mirrors read_spend_tier's awk parsing style.
read_scan_time() {
  local raw=""
  if [[ -f "$PROFILE_FILE" ]]; then
    raw=$(
      awk -F: '
        /^[[:space:]]*daily_scan_time[[:space:]]*:/ {
          value = substr($0, index($0, ":") + 1)
          print value
          exit
        }
      ' "$PROFILE_FILE"
    )
    raw="${raw%%#*}"
    raw="$(printf '%s' "$raw" | tr -d "[:space:]'\"")"
  fi
  printf '%s\n' "${raw:-unset}"
}

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] === career-ops daily scan started (profile.yml daily_scan_time: $(read_scan_time)) ===" >> "$LOG_FILE"

acquire_lock

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ERROR: $PROMPT_FILE not found — cannot run daily scan." >> "$LOG_FILE"
  exit 1
fi

# Prompt-delivery pattern mirrors batch-runner.sh (the repo's proven headless
# path): SKILL.md is loaded as the SYSTEM prompt via --append-system-prompt-file,
# and a short imperative line is passed as the user turn. Passing the raw 24KB
# SKILL.md as a single positional prompt has failed every way it can: the leading
# `---` frontmatter parses as an option ("error: unknown option '---") without a
# `--` separator, and with `--` the model either answered passively ("no user
# message or task has come through yet") or the CLI hung/errored with no output.
# Splitting system-prompt-file + task avoids argv quoting/length entirely and puts
# the task in the user turn where the model acts on it (validated 2026-08-14 by
# the DONE_PATTERN_OK synthetic test run from this project dir).
#
# Model resolved the same way batch-runner.sh does: profile.yml spend_tier →
# tier/model map, standard default. No spend_tier in the profile today → sonnet.
read_spend_tier() {
  local raw=""
  if [[ -f "$PROFILE_FILE" ]]; then
    raw=$(
      awk -F: '
        /^[[:space:]]*spend_tier[[:space:]]*:/ {
          value = substr($0, index($0, ":") + 1)
          print value
          exit
        }
      ' "$PROFILE_FILE"
    )
    raw="${raw%%#*}"
    raw="$(printf '%s' "$raw" | tr -d "[:space:]'\"")"
  fi
  printf '%s\n' "${raw:-standard}"
}
resolve_model() {
  case "$(read_spend_tier)" in
    economy) echo "claude-haiku-4-5" ;;
    premium) echo "claude-opus-5" ;;
    standard|*) echo "claude-sonnet-5" ;;
  esac
}
# NOTE: --strict-mcp-config is deliberately NOT passed. That flag means "only
# use servers from --mcp-config, ignore all other MCP configurations" — and this
# script passes no --mcp-config, so it would load ZERO MCP servers and strip the
# account-linked Indeed/Gmail connectors from headless runs (observed 2026-08-14:
# Tier-1 fell back to WebSearch substitutions, ~6 matches). The connectors live
# at the account level (claude.ai), not in ~/.claude.json mcpServers, so there
# is no config file to point --mcp-config at — the fix is just to let the default
# MCP discovery run.
TASK="Execute the following scheduled task now. This is a real, active task — begin immediately with Step 0, work through as many tiers as your budget allows per the HARD RULE section, and do not stop to ask for confirmation or wait for further input."

# caffeinate -i prevents idle system sleep for the duration of the wrapped
# command and releases automatically when it exits. Needed because this runs
# as a genuinely unattended launchd job: the 2026-08-15 06:00 run fired on
# wake (machine asleep at 06:00, launchd caught the missed run at 10:17 UTC),
# then the Mac fell back asleep mid-run and killed claude with "API Error:
# Your computer went to sleep mid-response. The response above may be
# incomplete." (exit 1, cleanly logged and lock released — but the run was
# dead). A run that keeps the screen awake for the duration of claude's work
# can't be sleep-interrupted.
set +e
caffeinate -i "$CLAUDE_BIN" -p --dangerously-skip-permissions \
  --model "$(resolve_model)" \
  --append-system-prompt-file "$PROMPT_FILE" \
  "$TASK" >> "$LOG_FILE" 2>&1
rc=$?
set -e
if (( rc != 0 )); then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ERROR: daily scan failed with exit code $rc" >> "$LOG_FILE"
  exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] === career-ops daily scan finished ===" >> "$LOG_FILE"
