# Skill, Bio, Selection, and Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-command collective-memory capture flow, richer project capture for terse cards, a central persona bio drawer, persistent project exclusion, and a browser smoke test.

**Architecture:** Keep the skill contract changes in `collective-memory-skill/` and the runtime behavior in `collective-memory-ui/`. Use small pure helpers for narrative generation and project visibility so the UI stays testable. Add a standalone Playwright-driven smoke script that targets stable `data-testid` hooks.

**Tech Stack:** Markdown skill docs, Node.js scripts, React 19, Vite, IndexedDB, Playwright, Node test runner.

---

### Task 1: Skill orchestration and richer capture contract

**Files:**
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-skill/SKILL.md`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-skill/CLAUDE.md`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-skill/AGENTS.md`

- [ ] **Step 1: Extend the skill contract**

Add a new `/memoria collect` command that runs the full pipeline in one pass: scan, register, profile, connections, build-readme, and research-sync.

- [ ] **Step 2: Expand register requirements**

Require richer project cards with structured fields such as `abstract`, `objectives`, `methodology`, `evidence`, `outputs`, `related_projects`, `crossovers`, and `expansion_ideas` when the source material supports them.

- [ ] **Step 3: Update agent guidance**

Make the agent inspect README/docs/code for terse projects before writing the final JSON card, and prefer richer structured summaries over one-line descriptions.

### Task 2: Project visibility and persona narrative helpers

**Files:**
- Create: `/Users/nestor/Documents/ReMember2/collective-memory-ui/src/lib/projectVisibility.js`
- Create: `/Users/nestor/Documents/ReMember2/collective-memory-ui/src/lib/profileNarrative.js`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-ui/src/lib/memoryStore.js`
- Test: `/Users/nestor/Documents/ReMember2/collective-memory-ui/src/lib/profileNarrative.test.js`
- Test: `/Users/nestor/Documents/ReMember2/collective-memory-ui/src/lib/projectVisibility.test.js`

- [x] **Step 1: Write the failing helper tests**

Cover the two core behaviors:
`buildProfileNarrative()` should surface the user overview, cluster routes, and expansion ideas from sample profile/project/connection data.
`filterVisibleProjects()` should exclude hidden project IDs without mutating the original list.

- [x] **Step 2: Implement the helpers minimally**

Add pure functions for classification, route extraction, narrative sections, and hidden-project filtering. Extend storage helpers to persist hidden project IDs with the existing snapshot data.

- [x] **Step 3: Verify the helpers**

Run the Node tests and confirm the narrative and visibility helpers behave deterministically.

### Task 3: UI drawer, central bio, and project exclusion

**Files:**
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-ui/src/App.jsx`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-ui/src/index.css`

- [x] **Step 1: Wire the new data model into the app**

Use the visibility helper before lens filtering, hydrate persisted hidden projects on boot, and persist updates when a project is excluded or restored.

- [x] **Step 2: Add the profile drawer**

Clicking the center node should open a structured persona drawer built from the narrative helper, with sections for overview, dominant threads, project routes, and expansion ideas.

- [x] **Step 3: Add project exclusion controls**

Add a project-level action to remove the project from the rendered selection, show an excluded-project list, and provide a restore action.

- [x] **Step 4: Add stable smoke hooks**

Add `data-testid` hooks for the guide panel, core node, project nodes, drawer, and selection controls so the smoke script can target the UI reliably.

### Task 4: Browser smoke

**Files:**
- Create: `/Users/nestor/Documents/ReMember2/collective-memory-ui/scripts/browser-smoke.mjs`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-ui/package.json`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-ui/README.md`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-ui/STATUS.md`

- [x] **Step 1: Add a failing smoke script entry**

Add `npm run smoke` and make the script open the local preview server, verify the onboarding rail, open the central bio drawer, and open a project drawer.

- [x] **Step 2: Implement the smoke runner**

Use Playwright in a plain Node script, not `@playwright/test`, and keep the assertions focused on the stable test ids.

- [x] **Step 3: Verify the smoke**

Run the smoke locally against the built app and confirm it catches the expected UI surfaces.

### Task 5: Documentation and verification

**Files:**
- Modify: `/Users/nestor/Documents/ReMember2/README.md`
- Modify: `/Users/nestor/Documents/ReMember2/STATUS.md`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-ui/README.md`
- Modify: `/Users/nestor/Documents/ReMember2/collective-memory-ui/STATUS.md`

- [ ] **Step 1: Align docs with the new workflow**

Document the one-command skill flow, the richer capture contract, the profile bio drawer, the exclusion controls, and the smoke script.

- [ ] **Step 2: Verify end-to-end**

Run the unit tests, lint, build, smoke, and a final Git diff check before committing.
