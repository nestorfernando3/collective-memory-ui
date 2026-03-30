# Balanced Connection Engine Redesign Spec

**Goal:** Rebuild how the memory graph creates and shows project connections so the graph regains useful breadth without returning to noisy, weak, or repetitive links.

**Architecture:** Keep `collective-memory/scripts/research_sync.js` as the scoring and orchestration layer, but split its output into `strong`, `exploratory`, and `discarded` tiers. Preserve the existing `connections.json` array contract by adding optional fields for tier, visibility, selection reason, and evidence breakdown. Update the UI logic to consume those tiers explicitly instead of flattening every connection into one visible layer or collapsing weak copy to the same generic fallback sentence.

**Tech Stack:** Node.js, `node:test`, JSON snapshot files, React/React Flow helpers in `src/lib`, existing public shell served through `memoria-colectiva.js`, plus restoration of an editable `src/App.jsx` entrypoint before UI integration work.

---

## Chosen Design Decisions

- Use a two-layer model: `strong` connections for the main graph and `exploratory` connections for optional or rescue visibility.
- Weight both document evidence and structured metadata. Neither one alone is enough for a strong connection in most cases.
- Hide exploratory edges by default, except for a narrow coverage-floor rule that may promote one good exploratory edge for a project that would otherwise be isolated.
- Keep `connections.json` backward-compatible by extending each connection object instead of replacing the schema.
- Replace generic fallback prose with tier-aware descriptions that still name concrete shared evidence.

## Problem Statement

The current engine swung from one failure mode to the opposite one:

- Earlier, too many pairings reached the graph, and many of them were weak, repetitive, or hard to defend.
- Now, `research_sync.js` applies strict pruning and high thresholds, which leaves very few surviving links.
- The UI then compresses several weak or noisy descriptions into a generic provisional message, so the surviving graph feels even thinner and less informative than the raw data already is.

The redesign has to fix quantity and legibility together. Lowering thresholds alone will recreate clutter. Keeping the current thresholds alone will preserve scarcity.

## Scope

- Add evidence-aware tier classification in `collective-memory/scripts/research_sync.js`.
- Add a coverage-floor policy so isolated projects can recover one visible bridge when the evidence is decent but not strong.
- Keep rich evidence breakdowns on each connection so later ranking, reporting, and UI logic can reason over them.
- Improve local narrative generation so strong and exploratory connections sound different and both remain specific.
- Update the UI data helpers so the default graph, the project drawer, and the central profile narrative understand connection tiers and visibility.
- Restore or recreate an editable UI entrypoint before changing graph rendering behavior.

## Non-Goals

- No new database or external service.
- No attempt to infer large thematic routes first and derive pairwise edges second.
- No free-form LLM requirement for the default path.
- No redesign of node layout or general visual style outside the connection-related controls and cues.

## Data Contract

Each connection keeps the current core fields:

- `from`
- `to`
- `type`
- `strength`
- `description`
- `source`
- `evidence`

Each connection may gain these optional fields:

- `tier`: `strong` or `exploratory`
- `visibility`: `default` or `optional`
- `selection_reason`: `strong-evidence`, `coverage-floor`, or `exploratory`
- `evidence.breakdown`: object with `metadata`, `documents`, `semanticBridge`, `explicitRelation`, and `total`

This keeps the snapshot import path stable for old consumers while giving the new UI enough structure to distinguish what should be rendered by default and why.

## Engine Behavior

### 1. Evidence Scoring Stays Additive

`scorePair()` continues to aggregate evidence from:

- shared metadata fields
- shared metadata tokens
- shared document tokens
- shared document signals
- semantic bridge heuristics
- explicit project cross-references

That part remains the raw scoring layer.

### 2. Tier Classification Happens After Raw Scoring

Each candidate is classified into:

- `strong`: clear mixed evidence, suitable for the default graph
- `exploratory`: promising but not yet definitive, suitable for optional display or coverage rescue
- `discarded`: too weak or too generic to keep

The default rule is:

- `strong` requires a high total score plus a real document anchor and either metadata or semantic support.
- `exploratory` allows decent score plus one solid anchor, but not enough for full confidence.
- theory-only or generic-token-only links stay out unless they accumulate stronger support.

### 3. Coverage-Floor Policy Runs After Tiering

After all candidates are classified:

- every `strong` connection becomes `visibility: default`
- every `exploratory` connection becomes `visibility: optional`
- for any project with zero default-visible connections, the engine may promote the best exploratory candidate to `visibility: default` when it exceeds a stricter rescue threshold

That rescue path is narrow by design. It exists to avoid dead nodes, not to refill the graph with noise.

### 4. Narrative Generation Becomes Tier-Aware

Strong links should explain what is shared and why the bridge matters.

Exploratory links should:

- stay specific about the evidence they do have
- state briefly that the bridge is still tentative
- never collapse to one fixed phrase like `Cruce provisional: la evidencia compartida todavía no alcanza para sostenerlo.`

### 5. UI Consumes Tier and Visibility Directly

The UI should support two modes:

- default mode: show `visibility: default`
- expanded mode: show both default and optional links

The drawer and project-level connection lists should expose:

- `tier`
- `selection_reason`
- stronger descriptive copy

The profile narrative should count visible strong bridges separately from exploratory ones if it needs aggregate summaries.

## UI Constraint

The current repository does not contain a live `src/App.jsx`, even though `src/main.jsx` imports it. The public shell is currently bundled into `memoria-colectiva.js`, which is not a maintainable place for logic changes.

Before tier-aware rendering work starts, the implementation must restore an editable source entrypoint and make it the source of truth for graph rendering again. Patching the minified bundle directly is not an acceptable path.

## Acceptance Criteria

- The graph no longer collapses to a tiny set of only ultra-strict links.
- The graph does not return to the earlier state of many vague or redundant pairings.
- At least one decent bridge can appear for an otherwise isolated project without making exploratory links globally noisy.
- `connections.json` remains import-compatible for the existing snapshot workflow.
- The project drawer can distinguish strong vs exploratory connections.
- Exploratory prose remains specific and evidence-based instead of generic boilerplate.
- The implementation path includes a maintainable editable UI source file, not only changes to `memoria-colectiva.js`.

## Risks and Mitigations

- Risk: lowering thresholds alone recreates clutter.
  - Mitigation: tier first, then visibility policy.

- Risk: hiding all exploratory links keeps the graph too sparse.
  - Mitigation: narrow coverage-floor promotion for isolated projects.

- Risk: the UI cannot be safely changed because the current live shell is minified.
  - Mitigation: restore `src/App.jsx` before tier-aware graph integration.

- Risk: user-facing copy becomes repetitive again.
  - Mitigation: tier-aware narrative templates plus stricter generic-fallback detection.
