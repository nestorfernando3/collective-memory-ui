#!/bin/bash
# sync.sh — Collective Memory Auto-Sync
# Copies data from collective-memory/ → collective-memory-ui/public/data/
# then commits and pushes to trigger GitHub Pages deploy.
#
# Usage: bash ~/Documents/ReMember2/collective-memory/scripts/sync.sh

set -e

BASE_DIR="$HOME/Documents/ReMember2"
DATA_DIR="$BASE_DIR/collective-memory"
UI_DIR="$BASE_DIR/collective-memory-ui"
UI_DATA="$UI_DIR/public/data"

echo "🔄 Syncing Collective Memory..."

# Ensure target directories exist
mkdir -p "$UI_DATA/projects"

# Sync profile
if [ -f "$DATA_DIR/profile.json" ]; then
  cp "$DATA_DIR/profile.json" "$UI_DATA/profile.json"
  echo "  ✅ profile.json synced"
fi

# Sync connections
if [ -f "$DATA_DIR/connections.json" ]; then
  cp "$DATA_DIR/connections.json" "$UI_DATA/connections.json"
  echo "  ✅ connections.json synced"
fi

# Sync projects + regenerate index
if [ -d "$DATA_DIR/projects" ]; then
  rsync -a --delete "$DATA_DIR/projects/" "$UI_DATA/projects/"
  ls -1 "$DATA_DIR/projects" | grep '\.json$' > "$UI_DATA/projects_index.json"
  echo "  ✅ Projects synced and index regenerated"
fi

# Commit and push from UI dir
cd "$UI_DIR" || exit 1

if [ ! -d ".git" ]; then
  echo "  ⚠️ Not a git repo — skipping push."
  exit 0
fi

echo "  🏗️ Building static PWA bundle..."
npx build >/dev/null 2>&1 || npm run build >/dev/null 2>&1

echo "  🚀 Deploying private data to GitHub Pages (gh-pages branch)..."
npx --yes gh-pages -d dist -t true -m "🧠 Auto-sync: Memory updated" && echo "  ✅ Successfully deployed memory to GitHub Pages!" \
  || echo "  ⚠️ Deploy failed — check git remote or npm setup."

echo "✨ Done!"
