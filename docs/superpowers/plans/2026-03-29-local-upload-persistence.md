# Persistent Local Upload & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser-persistent memory import flow with a visible onboarding rail and keep the graph workspace functional with demo fallback.

**Architecture:** Keep the parser, storage, and UI layout separate. The parser turns folder uploads into a normalized snapshot. The storage layer saves and restores that snapshot through IndexedDB. The UI hydrates from persisted data first, demo data second, and exposes the upload/clear actions in a fixed onboarding rail.

**Tech Stack:** React 19, Vite 8, @xyflow/react, IndexedDB, vanilla CSS, Node test runner.

---

### Task 1: Parser for folder uploads

**Files:**
- Create: `src/lib/memoryBundle.js`
- Create: `src/lib/memoryBundle.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMemoryBundleFromEntries } from './memoryBundle.js';

test('extracts profile, connections, and nested project files from a folder listing', () => {
  const bundle = extractMemoryBundleFromEntries([
    { path: 'Memory/profile.json', text: '{"name":"Nestor"}' },
    { path: 'Memory/connections.json', text: '{"connections":[{"source":"a","target":"b"}]}' },
    { path: 'Memory/projects/a.json', text: '{"id":"a","name":"Project A"}' },
  ], { sourceLabel: 'Memory' });

  assert.equal(bundle.profile.name, 'Nestor');
  assert.equal(bundle.connections.connections.length, 1);
  assert.deepEqual(bundle.projects.map((project) => project.id), ['a']);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test src/lib/memoryBundle.test.js`
Expected: module-not-found or missing export failure before implementation exists.

- [ ] **Step 3: Implement the minimal parser**

```javascript
export function extractMemoryBundleFromEntries(entries, options = {}) {
  // Normalize paths, find profile.json, connections.json, and projects/*.json,
  // then return a bundle with source metadata.
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test src/lib/memoryBundle.test.js`
Expected: PASS with one passing test.

### Task 2: Browser persistence layer

**Files:**
- Create: `src/lib/memoryStore.js`

- [ ] **Step 1: Write the storage API**

```javascript
const DB_NAME = 'collective-memory-ui';
const STORE_NAME = 'snapshots';
const STORAGE_KEY = 'active-snapshot';

export async function savePersistedSnapshot(snapshot) {}
export async function loadPersistedSnapshot() {}
export async function clearPersistedSnapshot() {}
```

- [ ] **Step 2: Run a smoke check**

Run: `node -e "import('./src/lib/memoryStore.js').then(m => console.log(Object.keys(m).sort().join(',')))"`
Expected: `clearPersistedSnapshot,loadPersistedSnapshot,savePersistedSnapshot`

- [ ] **Step 3: Implement IndexedDB writes and reads**

```javascript
// Open the DB lazily, create the object store on upgrade, and store a single
// snapshot under one stable key.
```

- [ ] **Step 4: Smoke-check the module again**

Run: `node -e "import('./src/lib/memoryStore.js').then(m => console.log(typeof m.loadPersistedSnapshot))"`
Expected: `function`

### Task 3: App orchestration and onboarding rail

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Hydrate demo and persisted memory on startup**

```javascript
const [demoBundle, persistedBundle] = await Promise.all([
  loadDemoBundle(),
  loadPersistedSnapshot().catch(() => null),
]);

if (persistedBundle?.profile) {
  hydrateBundle(persistedBundle, 'local');
} else {
  hydrateBundle(demoBundle, 'demo');
}
```

- [ ] **Step 2: Wire folder upload and clear actions**

```javascript
const bundle = extractMemoryBundleFromEntries(entries);
await savePersistedSnapshot(bundle);
hydrateBundle(bundle, 'local');
```

- [ ] **Step 3: Add the persistent onboarding rail**

```jsx
<aside className="guide-panel">
  <section className="guide-step">...</section>
  <section className="guide-step">...</section>
  <section className="guide-step">...</section>
</aside>
```

- [ ] **Step 4: Keep the graph workspace functional**

```jsx
<main className="graph-panel">
  <ReactFlow ... />
  <div className={`drawer ${isDrawerOpen ? 'open' : ''}`}>...</div>
</main>
```

### Task 4: Layout and responsive styling

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the two-column app shell**

```css
.app-shell {
  display: grid;
  grid-template-columns: clamp(320px, 31vw, 440px) minmax(0, 1fr);
}
```

- [ ] **Step 2: Style the onboarding rail**

```css
.guide-panel {
  border-right: 4px solid var(--ink-black);
  padding: 32px 28px;
}
```

- [ ] **Step 3: Style the graph panel and source chip**

```css
.graph-panel {
  position: relative;
}

.source-chip.local {
  background: var(--ink-black);
  color: var(--paper-white);
}
```

- [ ] **Step 4: Add responsive stacking for mobile**

```css
@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
}
```

### Task 5: Documentation sync

**Files:**
- Modify: `README.md`
- Modify: `STATUS.md`

- [ ] **Step 1: Rewrite the onboarding section**

```markdown
1. Install the `collective-memory` skill.
2. Run `/memoria scan`, `/memoria register`, `/memoria profile`, and `/memoria connections`.
3. Upload the exported local folder into the app.
4. Let the browser persist the last imported snapshot.
```

- [ ] **Step 2: Update the status file**

```markdown
- The app now keeps the last uploaded memory in IndexedDB.
- The onboarding rail explains the skill-install and upload flow on screen.
```
