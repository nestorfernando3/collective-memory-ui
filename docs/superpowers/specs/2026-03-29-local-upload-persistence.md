# Persistent Local Upload & Onboarding Design

**Goal:** Let visitors install the `collective-memory` skill, collect their data locally, upload the resulting folder into the UI, and have the browser restore that memory automatically on later visits.

**Architecture:** The app is split into two visible regions: a left onboarding rail and a right graph workspace. The onboarding rail explains the skill installation and data-collection steps, while the workspace renders either the demo memory bundled with the repo or the user’s persisted local snapshot. Folder ingestion is handled by a small pure parser, and the uploaded snapshot is stored in IndexedDB so it survives refreshes and browser restarts.

**Tech Stack:** React 19, Vite 8, @xyflow/react, IndexedDB, vanilla CSS, Lucide React.

---

## Behavior

- The app shows onboarding instructions on screen at all times.
- The onboarding copy explains how to install `collective-memory`, run `/memoria scan`, `/memoria register`, `/memoria profile`, and `/memoria connections`, then upload the exported folder.
- The app accepts a local folder upload and reads `profile.json`, `connections.json`, and `projects/*.json`.
- The browser stores the parsed snapshot locally and reloads it automatically on future visits.
- The app keeps a demo memory as fallback so the graph stays visible even before a user uploads their own data.

## Acceptance Criteria

- Uploading a valid folder updates the graph without a page reload.
- Refreshing the page restores the last uploaded memory from browser storage.
- Clearing local memory removes the persisted snapshot and returns the demo memory.
- The onboarding rail remains visible on desktop and stacks cleanly on mobile.
