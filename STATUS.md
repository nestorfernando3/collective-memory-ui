# Collective Memory — Implementation Status
**Updated:** 2026-03-29 | **Session:** 29803a1d

---

## 🚀 FINALIZED: Generic Framework Transformation

We have successfully pivoted the project from a hardcoded personal portfolio into a **Universal React Framework** (Bring Your Own Data).

### 1. Privacy-First "BYOD" Architecture (Bring Your Own Data)
- **Zero-Data Repository:** The `public/data/` folder is now strictly `.gitignore`'d. Personal projects and connections will never be committed to the open-source repository.
- **Universal Local Rendering:** Modified `App.jsx` to dynamically load data via the browser's `File` API (`webkitdirectory`). Users can now visit the URL and upload their local JSON folder to visualize their graph without installing anything.
- **Floating Upload Button:** Added a UI affordance so anyone can swap the rendered dataset live on the site.

### 2. Deployment Pipeline
- **`gh-pages` Branch Strategy:** Implemented a new secure pipeline. `sync.sh` now builds the production bundle and deploys *only* the compiled static assets to a separate `gh-pages` branch, completely isolating source code from personal data.
- **Onboarding Tutorial:** Rewritten `README.md` to serve as a step-by-step generic tutorial. Teaches users how to maintain a secret folder for their JSON files and sync it safely.

---

## ✅ COMPLETED (Recent Fixes)

### Folder Structure Migration
- [x] Moved everything into a clean `ReMember2/` workspace 
- [x] Removed the hardcoded GitHub repo URL from `init_memory.sh`
- [x] Moved brain data into `ReMember2/collective-memory/`

### UI / Layout & Graph Clutter
- [x] **Editorial Brutalism Empty State:** Added an onboarding screen for visitors who load the tool with no default data.
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
- [x] Automates `npm run build` and `npx gh-pages`

### Research Sync
- [x] Local Research Sync CLI implemented to rank existing connections and propose new ones from metadata plus local notes
- [x] Existing connection reports now surface strengthening candidates instead of hiding them

---

## 🔄 UPDATED FROM YOUR COMMENTS

| Item | Notes |
|------|-------|
| **Research Sync** | Local matcher/report generator implemented; `/memoria collect` now covers scan/register/profile/connections/build-readme in one pass |
| `/memoria strengthen` | Uses abstracts first, then inspects actual `.docx`/`.md` prose for theoretical matrices, repeated citations, and data reuse |
| External data | Optional LLM prose layer is now supported behind `OPENAI_API_KEY` with deterministic fallback; tune it with `OPENAI_NARRATIVE_MODEL` or `OPENAI_MODEL` |

## ✅ Recent UI/Skill Additions
- Added richer project registration guidance so terse cards can be rebuilt from README/docs/source evidence.
- Added a central persona drawer in the UI that synthesizes biography, project routes, and expansion ideas from the memory graph.
- Added persistent project exclusion/restoration so users can trim the visible selection without deleting data.
- Added a Playwright browser smoke that checks onboarding, profile drawer, project drawer, and exclusion flow.

---

## 🗂 Key Files (New Paths)

| File | Location |
|------|----------|
| UI App | `~/Documents/ReMember2/collective-memory-ui/` |
| Brain Source Data | `~/Documents/ReMember2/collective-memory/projects/` |
| Sync Script | `~/Documents/ReMember2/collective-memory/scripts/sync.sh` |
| Status Dashboard | `~/Documents/ReMember2/collective-memory/scripts/status.js` |
| Setup Wizard | `~/Documents/ReMember2/collective-memory-ui/init_memory.sh` |
