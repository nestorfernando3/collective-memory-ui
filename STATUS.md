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

### Research Sync
- [x] Local Research Sync CLI implemented to rank existing connections and propose new ones from metadata plus local notes
- [x] Existing connection reports now surface strengthening candidates instead of hiding them

---

## 🔧 PENDING (from your comments)

| Item | Notes |
|------|-------|
| **Research Sync** | Local matcher/report generator implemented; AI-backed enrichment can be layered next |
| `/memoria strengthen` | Use abstracts first, fallback to scanning actual `.docx`/`.md` files |
| External data | Optional next step if you want the helper to call an LLM for richer prose |
| Status Dashboard CLI | Path update to match new ReMember2 setup |

---

## 📋 NEXT ACTION (Research Sync)

**Research Sync** — when you describe a project in conversation, the system:
1. Reads existing project metadata from `ReMember2/collective-memory/projects/`
2. If needed, scans matching `.docx`/`.md` notes in `~/Documents/` and `collective-memory/`
3. Ranks existing links to strengthen and proposes new connections
4. Can write validated new connections back into `connections.json`

---

## 🗂 Key Files (New Paths)

| File | Location |
|------|----------|
| UI App | `~/Documents/ReMember2/collective-memory-ui/` |
| Brain Source Data | `~/Documents/ReMember2/collective-memory/projects/` |
| Sync Script | `~/Documents/ReMember2/collective-memory/scripts/sync.sh` |
| Status Dashboard | `~/Documents/ReMember2/collective-memory/scripts/status.js` |
| Setup Wizard | `~/Documents/ReMember2/collective-memory-ui/init_memory.sh` |
