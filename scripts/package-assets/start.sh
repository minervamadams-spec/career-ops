#!/usr/bin/env bash
# start.sh — one-command launch for Offerly. Run this from the folder it's in.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/web"

echo "Offerly — starting up"
echo

# Mirrors start.bat's winget path: try an automatic install via Homebrew
# before falling back to "go get it yourself" — most non-technical Mac
# recipients don't have Node, and pointing them at a terminal command they
# have to run themselves is the same friction start.bat exists to avoid on
# Windows.
node_ok() {
  command -v node >/dev/null 2>&1 && [ "$(node -v | sed 's/^v//' | cut -d. -f1)" -ge 20 ]
}

if ! node_ok; then
  if command -v node >/dev/null 2>&1; then
    echo "Found Node.js $(node -v), but this needs Node 20 or newer."
  else
    echo "Node.js isn't installed yet."
  fi

  if command -v brew >/dev/null 2>&1; then
    echo "Trying to install it automatically via Homebrew..."
    echo
    brew install node || true
  fi

  if ! node_ok; then
    echo
    echo "Get it free at https://nodejs.org (the 'LTS' button), install it, then run this again."
    exit 1
  fi
fi

if [ ! -d node_modules ]; then
  echo "First-time setup — installing what this needs (a minute or two)..."
  npm install
fi

echo "Building..."
npm run build

echo
echo "Starting Offerly at http://localhost:3000"
echo "(Leave this window open — closing it stops the app. Ctrl+C to quit.)"
echo

# Open the browser once the server is actually ready, not before.
(
  for _ in $(seq 1 60); do
    if curl -sS -o /dev/null "http://localhost:3000" 2>/dev/null; then
      if command -v open >/dev/null 2>&1; then open "http://localhost:3000"
      elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:3000"
      fi
      break
    fi
    sleep 1
  done
) &

npm run start
