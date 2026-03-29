# Collective Memory — Implementation Status
**Updated:** 2026-03-29 | **Session:** 29803a1d

---

## ✅ COMPLETED (Recent Fixes)

### Folder Structure Migration
- [x] Moved everything into a clean `ReMember2/` workspace 
- [x] Removed the hardcoded GitHub repo URL from `init_memory.sh`
- [x] Moved brain data into `ReMember2/collective-memory/`

### UI / Layout & Graph Clutter
- [x] Coordinate system normalized to `(0,0)` origin
- [x] Concentric ring layout implemented
- [x] **Dynamic Radii:** Nodes do not overlap anymore! Radius scales with the number of projects (Radius = ~435+ for large numbers of nodes so they don't crash into each other)
- [x] `fitView()` called imperatively after data loads and re-triggered on resize
- [x] Drawer is a full bottom sheet on mobile (CSS) with `100dvh` fix for Safari address bar

### Data Layer
- [x] All 19 project cards have `description` fields  
- [x] Status normalization in scripts 

### Sync Infrastructure
- [x] `sync.sh` updated to sync from the `collective-memory/` folder to the `collective-memory-ui/public/data/` folder

---

## 🔧 PENDING (from your comments)

| Item | Notes |
|------|-------|
| **Research Sync** | **NEXT: Priority 1** (your feedback) |
| `/memoria strengthen` | Use abstracts first, fallback to scanning actual `.docx`/`.md` files |
| External data | Use user's own AI, not external APIs |
| Status Dashboard CLI | Path update to match new ReMember2 setup |

---

## 📋 NEXT ACTION (Research Sync)

**Research Sync** — when you describe a project in conversation, the system:
1. Reads existing project `abstracts` from `ReMember2/collective-memory/projects/`
2. If insufficient, scans the actual `.docx`/`.md` files in `~/Documents/`
3. Uses your AI to suggest theoretical connections between projects
4. Updates `connections.json` automatically

---

## 🗂 Key Files (New Paths)

| File | Location |
|------|----------|
| UI App | `~/Documents/ReMember2/collective-memory-ui/` |
| Brain Source Data | `~/Documents/ReMember2/collective-memory/projects/` |
| Sync Script | `~/Documents/ReMember2/collective-memory/scripts/sync.sh` |
| Status Dashboard | `~/Documents/ReMember2/collective-memory/scripts/status.js` |
| Setup Wizard | `~/Documents/ReMember2/collective-memory-ui/init_memory.sh` |
