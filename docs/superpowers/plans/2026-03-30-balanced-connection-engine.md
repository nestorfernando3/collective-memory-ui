# Balanced Connection Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the connection engine so it produces a balanced graph with strong default links, optional exploratory links, and better connection narratives.

**Architecture:** Keep raw pair scoring in `collective-memory/scripts/research_sync.js`, then add a second-pass tier classifier and a third-pass visibility policy. Preserve the `connections.json` array shape by adding optional tier and visibility metadata. Restore an editable React entrypoint so the UI can render strong and exploratory links intentionally instead of flattening them through the minified public shell.

**Tech Stack:** Node.js, `node:test`, JSON snapshot files, React, React Flow, existing helper tests in `src/lib`.

---

### Task 1: Add evidence breakdown and tier classification in `research_sync.js`

**Files:**
- Modify: `collective-memory/scripts/research_sync.js`
- Test: `collective-memory/scripts/research_sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEvidenceBreakdown, classifyConnectionTier } = require('./research_sync.js');

test('classifyConnectionTier separates strong and exploratory candidates', () => {
  const strong = classifyConnectionTier({
    score: 38,
    shared: {
      theoretical_frameworks: ['fenomenologia'],
      domains: ['educacion'],
      themes: [],
      tags: [],
      technologies: [],
      institutions: ['politecnico de la costa atlantica'],
      collaborators: [],
      outputs: [],
    },
    sharedDocSignals: {
      citations: ['Goffman, 1959'],
      theoryTerms: ['fenomenologia'],
      dataTerms: [],
      provenanceTerms: [],
      headings: ['Marco teórico'],
      quotedPhrases: [],
      keyPhrases: ['fenomenologia'],
    },
    signals: [{ field: 'document_citations' }, { field: 'semantic_bridge' }],
  });

  const exploratory = classifyConnectionTier({
    score: 24,
    shared: {
      theoretical_frameworks: ['fenomenologia'],
      domains: [],
      themes: [],
      tags: [],
      technologies: [],
      institutions: [],
      collaborators: [],
      outputs: [],
    },
    sharedDocSignals: {
      citations: [],
      theoryTerms: ['fenomenologia'],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
    signals: [{ field: 'document_theory_terms' }],
  });

  const discarded = classifyConnectionTier({
    score: 11,
    shared: {
      theoretical_frameworks: [],
      domains: [],
      themes: [],
      tags: [],
      technologies: [],
      institutions: [],
      collaborators: [],
      outputs: [],
    },
    sharedDocSignals: {
      citations: [],
      theoryTerms: [],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
    signals: [],
  });

  assert.equal(strong, 'strong');
  assert.equal(exploratory, 'exploratory');
  assert.equal(discarded, 'discarded');
  assert.deepEqual(
    Object.keys(buildEvidenceBreakdown({
      score: 38,
      signals: [{ field: 'metadata_tokens', weight: 2 }, { field: 'document_citations', weight: 8 }],
    })),
    ['metadata', 'documents', 'semanticBridge', 'explicitRelation', 'total'],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: FAIL because `buildEvidenceBreakdown` and `classifyConnectionTier` are not exported yet.

- [ ] **Step 3: Write minimal implementation**

```js
function buildEvidenceBreakdown(candidate = {}) {
  const signals = Array.isArray(candidate.signals) ? candidate.signals : [];
  return signals.reduce((acc, signal) => {
    const weight = Number(signal?.weight || 0);
    const field = String(signal?.field || '');
    if (field.startsWith('document_')) acc.documents += weight;
    else if (field === 'semantic_bridge') acc.semanticBridge += weight;
    else if (field === 'explicit_relation') acc.explicitRelation += weight;
    else acc.metadata += weight;
    acc.total = Number(Number(candidate.score || 0).toFixed(2));
    return acc;
  }, { metadata: 0, documents: 0, semanticBridge: 0, explicitRelation: 0, total: Number(Number(candidate.score || 0).toFixed(2)) });
}

function classifyConnectionTier(candidate = {}) {
  const breakdown = buildEvidenceBreakdown(candidate);
  const citations = candidate?.sharedDocSignals?.citations || [];
  const dataTerms = candidate?.sharedDocSignals?.dataTerms || [];
  const hasDocumentAnchor = breakdown.documents >= 8 || citations.length > 0 || dataTerms.length >= 2;
  const hasMetadataAnchor = breakdown.metadata >= 6;
  const hasSemanticAnchor = breakdown.semanticBridge >= 4 || breakdown.explicitRelation >= 10;

  if (candidate.score >= 35 && hasDocumentAnchor && (hasMetadataAnchor || hasSemanticAnchor)) return 'strong';
  if (candidate.score >= 22 && (hasDocumentAnchor || hasMetadataAnchor || hasSemanticAnchor)) return 'exploratory';
  return 'discarded';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add collective-memory/scripts/research_sync.js collective-memory/scripts/research_sync.test.js
git commit -m "feat: classify connection tiers from evidence breakdown"
```

### Task 2: Add coverage-floor visibility policy and persist tier metadata

**Files:**
- Modify: `collective-memory/scripts/research_sync.js`
- Test: `collective-memory/scripts/research_sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
const { applyVisibilityPolicy } = require('./research_sync.js');

test('applyVisibilityPolicy promotes one decent exploratory link for isolated projects', () => {
  const selected = applyVisibilityPolicy([
    { pairKey: 'alpha::beta', from: 'alpha', to: 'beta', score: 42, tier: 'strong' },
    { pairKey: 'beta::gamma', from: 'beta', to: 'gamma', score: 30, tier: 'exploratory' },
    { pairKey: 'gamma::delta', from: 'gamma', to: 'delta', score: 21, tier: 'exploratory' },
  ], ['alpha', 'beta', 'gamma', 'delta']);

  assert.equal(selected.find((item) => item.pairKey === 'alpha::beta').visibility, 'default');
  assert.equal(selected.find((item) => item.pairKey === 'beta::gamma').visibility, 'default');
  assert.equal(selected.find((item) => item.pairKey === 'beta::gamma').selectionReason, 'coverage-floor');
  assert.equal(selected.find((item) => item.pairKey === 'gamma::delta').visibility, 'optional');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: FAIL because `applyVisibilityPolicy` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
function applyVisibilityPolicy(candidates = [], projectIds = []) {
  const selected = candidates.map((candidate) => ({
    ...candidate,
    visibility: candidate.tier === 'strong' ? 'default' : 'optional',
    selectionReason: candidate.tier === 'strong' ? 'strong-evidence' : 'exploratory',
  }));

  const visibleCount = new Map(projectIds.map((projectId) => [projectId, 0]));
  selected.forEach((candidate) => {
    if (candidate.visibility !== 'default') return;
    visibleCount.set(candidate.from, (visibleCount.get(candidate.from) || 0) + 1);
    visibleCount.set(candidate.to, (visibleCount.get(candidate.to) || 0) + 1);
  });

  for (const projectId of projectIds) {
    if ((visibleCount.get(projectId) || 0) > 0) continue;
    const rescue = selected
      .filter((candidate) => candidate.tier === 'exploratory' && candidate.score >= 28 && (candidate.from === projectId || candidate.to === projectId))
      .sort((left, right) => right.score - left.score)[0];

    if (rescue) {
      rescue.visibility = 'default';
      rescue.selectionReason = 'coverage-floor';
    }
  }

  return selected;
}

function applyCandidateMetadata(connection, candidate) {
  return {
    ...connection,
    tier: candidate.tier,
    visibility: candidate.visibility,
    selection_reason: candidate.selectionReason,
    evidence: {
      ...(connection.evidence || {}),
      breakdown: buildEvidenceBreakdown(candidate),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add collective-memory/scripts/research_sync.js collective-memory/scripts/research_sync.test.js
git commit -m "feat: add coverage-floor visibility policy"
```

### Task 3: Make generated narratives tier-aware instead of generic

**Files:**
- Modify: `collective-memory/scripts/research_sync.js`
- Test: `collective-memory/scripts/research_sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
const { buildLocalDescription } = require('./research_sync.js');

test('buildLocalDescription differentiates strong and exploratory prose', () => {
  const strong = buildLocalDescription({
    tier: 'strong',
    fromName: 'Paideia',
    toName: 'Collective Memory PWA',
    sharedSummary: ['tecnologías: vite', 'instituciones: politecnico de la costa atlantica'],
    documentEvidence: 'Comparten citas o referencias verificables.',
    docSignals: {
      citations: ['Goffman, 1959'],
      theoryTerms: [],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
  });

  const exploratory = buildLocalDescription({
    tier: 'exploratory',
    fromName: 'Kansas-Barranquilla',
    toName: 'Artículo Kevin Cerra',
    sharedSummary: ['palabras compartidas: caribe'],
    documentEvidence: 'Comparten un marco conceptual explícito: caribe.',
    docSignals: {
      citations: [],
      theoryTerms: ['caribe'],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
  });

  assert.match(strong, /se apoya|se basa/i);
  assert.match(exploratory, /todavia|aun|por ahora/i);
  assert.doesNotMatch(exploratory, /Cruce provisional|se entiende mejor por las señales/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: FAIL because `buildLocalDescription` does not use `tier` yet.

- [ ] **Step 3: Write minimal implementation**

```js
function buildLocalDescription(context = {}) {
  const clauses = [];
  const lead = context.tier === 'strong'
    ? `La relación entre ${context.fromName} y ${context.toName} se apoya en ${context.sharedSummary.slice(0, 2).join('; ')}.`
    : `La relación entre ${context.fromName} y ${context.toName} todavía es tentativa, pero ya muestra señales útiles: ${context.sharedSummary.slice(0, 2).join('; ')}.`;

  clauses.push(lead);

  if (context.documentEvidence) clauses.push(context.documentEvidence);

  if ((context.docSignals?.provenanceTerms || []).length || (context.docSignals?.citations || []).length) {
    clauses.push('Si hay citas o material de terceros, conviene tratarlos como referencia y no como voz principal.');
  }

  return clauses.join(' ').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add collective-memory/scripts/research_sync.js collective-memory/scripts/research_sync.test.js
git commit -m "feat: generate tier-aware connection narratives"
```

### Task 4: Restore an editable UI entrypoint before graph integration

**Files:**
- Create: `src/App.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Run the failing build check**

Run: `npm run build`
Expected: FAIL because `src/main.jsx` imports `./App.jsx`, but `src/App.jsx` does not exist in the current repository state.

- [ ] **Step 2: Capture the current public-shell behavior as the restoration target**

Run: `git show bc8257f:src/App.jsx | sed -n '1,220p'`
Expected: A readable prior React entrypoint that can be restored as the baseline before tier-aware UI changes.

- [ ] **Step 3: Write minimal implementation**

```jsx
import { useMemo, useState } from 'react';
import { Background, ReactFlow, MarkerType } from '@xyflow/react';
import { buildProjectConnectionInsights } from './lib/connectionInsights.js';
import { buildProfileNarrative } from './lib/profileNarrative.js';

export default function App() {
  const [connectionVisibilityMode, setConnectionVisibilityMode] = useState('default');
  const graphData = useMemo(() => ({ nodes: [], edges: [] }), []);

  return (
    <div className="app-shell">
      <button type="button" onClick={() => setConnectionVisibilityMode((mode) => mode === 'default' ? 'all' : 'default')}>
        {connectionVisibilityMode === 'default' ? 'Show exploratory links' : 'Show strong links only'}
      </button>
      <ReactFlow nodes={graphData.nodes} edges={graphData.edges} fitView>
        <Background gap={40} />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 4: Run build to verify the source entrypoint exists again**

Run: `npm run build`
Expected: PASS, even if the tier-aware rendering is still incomplete.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/main.jsx
git commit -m "chore: restore editable ui entrypoint"
```

### Task 5: Teach the UI helpers to filter and label strong vs exploratory links

**Files:**
- Modify: `src/lib/connectionInsights.js`
- Modify: `src/lib/connectionInsights.test.js`
- Modify: `src/lib/connectionText.js`
- Modify: `src/lib/connectionText.test.js`
- Modify: `src/lib/profileNarrative.js`
- Modify: `src/lib/profileNarrative.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectConnectionInsights } from './connectionInsights.js';
import { isWeakGenericDescription } from './connectionText.js';

const projects = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
  { id: 'gamma', name: 'Gamma' },
];

test('buildProjectConnectionInsights hides optional exploratory links by default', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      { from: 'alpha', to: 'beta', tier: 'strong', visibility: 'default', type: 'Teórica', description: 'Comparten un marco conceptual explícito: fenomenología.' },
      { from: 'alpha', to: 'gamma', tier: 'exploratory', visibility: 'optional', selection_reason: 'exploratory', type: 'Exploratoria', description: 'Todavía es un puente tentativo, pero comparten citas.' },
    ],
    visibilityMode: 'default',
  });

  assert.deepEqual(insights.map((item) => item.otherProjectId), ['beta']);
  assert.equal(insights[0].tier, 'strong');
});

test('buildProjectConnectionInsights can include optional exploratory links on demand', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      { from: 'alpha', to: 'beta', tier: 'strong', visibility: 'default', type: 'Teórica', description: 'Comparten un marco conceptual explícito: fenomenología.' },
      { from: 'alpha', to: 'gamma', tier: 'exploratory', visibility: 'optional', selection_reason: 'exploratory', type: 'Exploratoria', description: 'Todavía es un puente tentativo, pero comparten citas.' },
    ],
    visibilityMode: 'all',
  });

  assert.deepEqual(insights.map((item) => item.otherProjectId), ['beta', 'gamma']);
  assert.equal(insights[1].tier, 'exploratory');
});

test('connectionText keeps specific exploratory prose out of the generic fallback bucket', () => {
  assert.equal(
    isWeakGenericDescription('La relación entre Alpha y Gamma todavía es tentativa, pero ya muestra señales útiles: citas compartidas y un marco conceptual explícito: rumor.'),
    false,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/connectionInsights.test.js src/lib/connectionText.test.js src/lib/profileNarrative.test.js`
Expected: FAIL because `visibilityMode`, `tier`, `selectionReason`, and the refined exploratory-text handling are not implemented yet.

- [ ] **Step 3: Write minimal implementation**

```js
export function buildProjectConnectionInsights({
  projectId,
  projects = [],
  connections = [],
  locale = 'en',
  visibilityMode = 'default',
} = {}) {
  const projectById = buildProjectById(projects);

  return (Array.isArray(connections) ? connections : [])
    .map((connection, index) => buildConnectionInsight(connection, projectById, `${projectId}-${index}`, locale))
    .filter((item) => item.source === projectId || item.target === projectId)
    .filter((item) => item.sourceProject && item.targetProject)
    .filter((item) => visibilityMode === 'all' || item.visibility === 'default')
    .sort((left, right) => {
      if (left.visibility !== right.visibility) return left.visibility === 'default' ? -1 : 1;
      if (left.tier !== right.tier) return left.tier === 'strong' ? -1 : 1;
      return right.strengthValue - left.strengthValue;
    });
}

export function isWeakGenericDescription(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (
    normalized.includes('todavia es tentativa') &&
    (normalized.includes('senales utiles') || normalized.includes('marco conceptual explicito') || normalized.includes('citas compartidas'))
  ) {
    return false;
  }

  return (
    normalized.includes('se entiende mejor por las senales') ||
    normalized.includes('sigue siendo exploratoria') ||
    normalized.includes('porque el vinculo parece acumulativo y no accidental')
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/connectionInsights.test.js src/lib/connectionText.test.js src/lib/profileNarrative.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/connectionInsights.js src/lib/connectionInsights.test.js src/lib/connectionText.js src/lib/connectionText.test.js src/lib/profileNarrative.js src/lib/profileNarrative.test.js
git commit -m "feat: add tier-aware connection insights"
```

### Task 6: Wire tier-aware controls and edge styling into the restored React shell

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing verification**

Run: `npm run build`
Expected: PASS, but the graph still renders all edges with one style and exposes no tier-aware toggle or drawer cue.

- [ ] **Step 2: Add the tier-aware rendering logic**

```jsx
const [connectionVisibilityMode, setConnectionVisibilityMode] = useState('default');

const visibleEdgeStyle = (connection) => connection.tier === 'exploratory'
  ? { stroke: '#E63946', strokeWidth: 1.5, strokeDasharray: '6 4', opacity: 0.6 }
  : { stroke: '#E63946', strokeWidth: 2, opacity: 1 };

const drawerConnections = buildProjectConnectionInsights({
  projectId: selectedProject.id,
  projects: visibleProjects,
  connections: graph.connections || [],
  locale,
  visibilityMode: connectionVisibilityMode,
});
```

- [ ] **Step 3: Expose the UI control and drawer metadata**

```jsx
<button
  type="button"
  className="source-chip connection-toggle"
  onClick={() => setConnectionVisibilityMode((mode) => mode === 'default' ? 'all' : 'default')}
>
  {connectionVisibilityMode === 'default' ? 'Show exploratory links' : 'Show strong links only'}
</button>

<span className={`connection-tier ${selectedConnection.tier}`}>
  {selectedConnection.tier === 'strong' ? 'Strong link' : 'Exploratory link'}
</span>
```

- [ ] **Step 4: Run build and manual smoke verification**

Run: `npm run build`
Expected: PASS.

Run: `rg -n "Show exploratory links|Strong link|Exploratory link|strokeDasharray" src/App.jsx src/App.css src/index.css`
Expected: The toggle, tier labels, and exploratory edge styling are present.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css src/index.css
git commit -m "feat: show strong and exploratory graph layers"
```

### Task 7: Update docs and status notes for the new graph model

**Files:**
- Modify: `README.md`
- Modify: `STATUS.md`
- Modify: `collective-memory-skill/SKILL.md`

- [ ] **Step 1: Write the failing verification**

Run: `rg -n "exploratory|coverage-floor|strong link|connections.json" README.md STATUS.md collective-memory-skill/SKILL.md`
Expected: No mention yet of the new two-layer connection model.

- [ ] **Step 2: Write minimal implementation**

```md
- The graph now distinguishes strong links from exploratory links.
- Exploratory links stay hidden by default unless the UI toggle is enabled or a project needs one rescue bridge to avoid isolation.
- `connections.json` keeps the same array shape and adds optional tier and visibility metadata.
```

- [ ] **Step 3: Run verification commands**

Run: `rg -n "exploratory|coverage-floor|strong link|connections.json" README.md STATUS.md collective-memory-skill/SKILL.md`
Expected: All three files describe the new behavior.

- [ ] **Step 4: Run final verification**

Run: `node --test collective-memory/scripts/research_sync.test.js src/lib/connectionInsights.test.js src/lib/profileNarrative.test.js && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md STATUS.md collective-memory-skill/SKILL.md
git commit -m "docs: describe balanced connection engine"
```
