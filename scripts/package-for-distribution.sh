#!/usr/bin/env bash
# package-for-distribution.sh — builds a clean, personal-data-free zip of
# Offerly for someone else to install and try. Run from anywhere:
#   ./scripts/package-for-distribution.sh [destination-dir]
# Defaults to ~/Desktop.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$HOME/Desktop}"
OUT_NAME="offerly-$(date +%Y-%m-%d)"
WORK="$(mktemp -d)"
STAGING="$WORK/$OUT_NAME"

mkdir -p "$DEST"
echo "Packaging Offerly from $REPO_ROOT"

cd "$REPO_ROOT"

# Packages the CURRENT WORKING TREE, not the last commit. `git archive HEAD`
# (the first version of this script) only exports what's actually committed —
# on a repo where work stays uncommitted for a long stretch (true here: a full
# day of rebrand/wizard/bug-report work sat uncommitted), that shipped a stale
# build with none of it, caught live when it opened in a browser still saying
# "career-ops" (2026-08-13). Fixed to union tracked + untracked-but-not-ignored
# files (git ls-files --cached --others --exclude-standard) and copy their
# REAL CURRENT CONTENT via rsync, not git's committed blobs. This still fully
# respects .gitignore, so cv.md/config/profile.yml/portals.yml/cv-variants/
# data/*/reports/*/output/*/jds/* are excluded exactly as before — verified
# again below, not just asserted.
mkdir -p "$STAGING"
git ls-files --cached --others --exclude-standard -z | rsync -a --files-from=- --from0 . "$STAGING/"

# Sanity check — refuse to package if something personal somehow made it in
# (belt-and-suspenders on top of git archive's own guarantee above). Matches by
# PREFIX (cv.md*, not just cv.md) so a variant like config/profile.yml.bak-{ts}
# is caught too — an exact-name check missed exactly that file on 2026-08-14
# because *.bak in .gitignore didn't match the timestamped suffix.
for f in cv.md config/profile.yml portals.yml; do
  MATCHES="$(find "$STAGING" -path "$STAGING/$f*" 2>/dev/null)"
  if [ -n "$MATCHES" ]; then
    echo "REFUSING TO PACKAGE: something matching $f is present in the archive — this should never happen." >&2
    echo "$MATCHES" >&2
    echo "Do not send this zip. Check .gitignore and git status before retrying." >&2
    rm -rf "$WORK"
    exit 1
  fi
done
# Catch-all for any stray backup file anywhere in the tree (both the plain
# *.bak writers and safe-write.ts's timestamped *.bak-{ts} writer).
BAKS="$(find "$STAGING" -name "*.bak" -o -name "*.bak-*" 2>/dev/null)"
if [ -n "$BAKS" ]; then
  echo "REFUSING TO PACKAGE: backup file(s) present in the archive — this should never happen." >&2
  echo "$BAKS" >&2
  rm -rf "$WORK"
  exit 1
fi
if [ -d "$STAGING/cv-variants" ] && [ -n "$(ls -A "$STAGING/cv-variants" 2>/dev/null)" ]; then
  echo "REFUSING TO PACKAGE: cv-variants/ has content in the archive — this should never happen." >&2
  rm -rf "$WORK"
  exit 1
fi
# cv-inputs/ is the real résumé/cover-letter vault (148 personal files as of
# 2026-08-14, when this check was added after they shipped in a real zip) —
# only the two generic template files belong in a distribution build.
if [ -d "$STAGING/cv-inputs" ]; then
  EXTRA="$(find "$STAGING/cv-inputs" -type f ! -name README.md ! -name default.md)"
  if [ -n "$EXTRA" ]; then
    echo "REFUSING TO PACKAGE: cv-inputs/ has personal files in the archive — this should never happen." >&2
    echo "$EXTRA" >&2
    rm -rf "$WORK"
    exit 1
  fi
fi

# Friend-facing onboarding files — start.bat is Windows' equivalent of
# start.sh (auto-installs Node via winget when missing/outdated, then
# install/build/start/open-browser). It was built 2026-08-13 but never wired
# in here, so every zip shipped since then left Windows recipients with only
# the old manual "install Node yourself, run 3 commands" path — exactly what
# Laura hit. Both now ship together.
cp "$REPO_ROOT/scripts/package-assets/START_HERE.md" "$STAGING/START_HERE.md"
cp "$REPO_ROOT/scripts/package-assets/start.sh" "$STAGING/start.sh"
cp "$REPO_ROOT/scripts/package-assets/start.bat" "$STAGING/start.bat"
chmod +x "$STAGING/start.sh"

cd "$WORK"
rm -f "$DEST/$OUT_NAME.zip"
zip -rq "$DEST/$OUT_NAME.zip" "$OUT_NAME"
rm -rf "$WORK"

echo
echo "Done: $DEST/$OUT_NAME.zip"
SIZE="$(du -h "$DEST/$OUT_NAME.zip" | cut -f1)"
echo "Size: $SIZE"
echo
echo "Send this zip to whoever's trying it. They unzip it, open START_HERE.md, and run ./start.sh."
