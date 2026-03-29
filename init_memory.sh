#!/bin/bash
# init_memory.sh — Collective Memory Setup Wizard
# For any new user forking the collective-memory-ui repository.
# Run once to initialize your local ~/.your-memory/ brain directory.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/YOUR_USER/collective-memory-ui/main/init_memory.sh | bash
#   — OR —
#   bash init_memory.sh

set -e

# ────────────────────────────────────────────
# Config
# ────────────────────────────────────────────
DEFAULT_BRAIN_DIR="$HOME/.collective-memory"
UI_REPO_URL="https://github.com/nestorfernando3/collective-memory-ui"

echo ""
echo "████████████████████████████████████████████████"
echo "  COLLECTIVE MEMORY — Setup Wizard"
echo "████████████████████████████████████████████████"
echo ""

# 1. Ask for brain directory
read -p "  📁 Brain directory [$DEFAULT_BRAIN_DIR]: " BRAIN_DIR
BRAIN_DIR="${BRAIN_DIR:-$DEFAULT_BRAIN_DIR}"

# 2. Ask for name
read -p "  👤 Your name: " USER_NAME
USER_NAME="${USER_NAME:-Researcher}"

# 3. Ask for site title
read -p "  🏷  Site title (e.g. 'My Research Universe'): " SITE_TITLE
SITE_TITLE="${SITE_TITLE:-Collective Memory}"

# 4. Ask for site subtitle
read -p "  ✏️  Site subtitle (e.g. 'PhD Candidate · MIT'): " SITE_SUBTITLE
SITE_SUBTITLE="${SITE_SUBTITLE:-Personal Operating System}"

# 5. Ask for UI repo directory
read -p "  🌐 Local path to collective-memory-ui repo: " UI_DIR
UI_DIR="${UI_DIR:-$HOME/collective-memory-ui}"

echo ""
echo "  ─────────────────────────────────────────────"
echo "  Creating brain at: $BRAIN_DIR"
echo "  ─────────────────────────────────────────────"

# ────────────────────────────────────────────
# Create directory structure
# ────────────────────────────────────────────
mkdir -p "$BRAIN_DIR/projects"

# ────────────────────────────────────────────
# Write profile.json
# ────────────────────────────────────────────
cat > "$BRAIN_DIR/profile.json" <<PROFILE
{
  "name": "$USER_NAME",
  "site_title": "$SITE_TITLE",
  "site_subtitle": "$SITE_SUBTITLE",
  "affiliations": [
    {
      "institution": "Your Institution",
      "role": "Your Role",
      "current": true
    }
  ],
  "location": {
    "city": "Your City",
    "country": "Your Country"
  },
  "domains": [],
  "skills": [],
  "languages": ["english"],
  "lenses": [
    { "id": "All", "label": "Full Universe", "filter": [] },
    { "id": "Research", "label": "Research", "filter": ["research", "academic", "paper"] },
    { "id": "Creative", "label": "Creative", "filter": ["creative", "art", "writing"] }
  ]
}
PROFILE

echo "  ✅ profile.json created"

# ────────────────────────────────────────────
# Write connections.json
# ────────────────────────────────────────────
cat > "$BRAIN_DIR/connections.json" <<CONN
{
  "connections": []
}
CONN

echo "  ✅ connections.json created"

# ────────────────────────────────────────────
# Write an example project card
# ────────────────────────────────────────────
cat > "$BRAIN_DIR/projects/my-first-project.json" <<PROJ
{
  "id": "my-first-project",
  "name": "My First Project",
  "type": "Research",
  "status": "Active",
  "description": "Describe what this project is about in 1-2 sentences.",
  "tags": ["research"]
}
PROJ

echo "  ✅ Example project card created"

# ────────────────────────────────────────────
# Write config.json
# ────────────────────────────────────────────
cat > "$BRAIN_DIR/config.json" <<CFG
{
  "name": "$USER_NAME",
  "data_dir": "$BRAIN_DIR",
  "ui_dir": "$UI_DIR",
  "scan_paths": ["$HOME/Documents"],
  "language": "en"
}
CFG

echo "  ✅ config.json created"

# ────────────────────────────────────────────
# Write sync.sh tailored to this user
# ────────────────────────────────────────────
cat > "$BRAIN_DIR/sync.sh" <<SYNC
#!/bin/bash
# Auto-generated sync script for $USER_NAME
BRAIN_DIR="$BRAIN_DIR"
UI_DIR="$UI_DIR"
UI_DATA="\$UI_DIR/public/data"

mkdir -p "\$UI_DATA/projects"

[ -f "\$BRAIN_DIR/profile.json" ] && cp "\$BRAIN_DIR/profile.json" "\$UI_DATA/profile.json"
[ -d "\$BRAIN_DIR/projects" ] && rsync -a --delete "\$BRAIN_DIR/projects/" "\$UI_DATA/projects/"
[ -f "\$BRAIN_DIR/connections.json" ] && cp "\$BRAIN_DIR/connections.json" "\$UI_DATA/connections.json"
ls -1 "\$BRAIN_DIR/projects" | grep '\.json$' > "\$UI_DATA/projects_index.json"

cd "\$UI_DIR" || exit 1
if [ -d ".git" ]; then
  git add public/data/
  if ! git diff-index --quiet HEAD --; then
    git commit -m "🧠 Auto-sync: Memory updated"
    git push origin main 2>/dev/null || git push origin master 2>/dev/null || echo "⚠️ Push failed — check remote."
  else
    echo "⏸ No changes to sync."
  fi
fi
echo "✨ Sync complete!"
SYNC
chmod +x "$BRAIN_DIR/sync.sh"

echo "  ✅ sync.sh generated"
echo ""
echo "  ─────────────────────────────────────────────"
echo "  🎉 Done! Your brain is ready at: $BRAIN_DIR"
echo ""
echo "  Next steps:"
echo "  1. Edit $BRAIN_DIR/profile.json with your real info"
echo "  2. Add project cards to $BRAIN_DIR/projects/"
echo "  3. Run: bash $BRAIN_DIR/sync.sh"
echo "  4. Push to GitHub → your portfolio is live!"
echo "  ─────────────────────────────────────────────"
echo ""
