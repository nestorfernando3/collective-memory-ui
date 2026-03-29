# Research Sync Strengthening and Narrative Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deep `.md`/`.docx` evidence scanning and optional LLM prose generation to `/memoria strengthen` and `research_sync.js`.

**Architecture:** Keep the existing CLI and JSON output shape. Add reusable helpers inside `research_sync.js` for document signal extraction, evidence-aware scoring, and connection narrative generation. The LLM integration is opt-in and wrapped in a safe fallback path that never blocks the workflow.

**Tech Stack:** Node.js, `node:test`, `unzip`, optional OpenAI Chat Completions API, JSON/Markdown.

---

### Task 1: Add deep document evidence extraction

**Files:**
- Modify: `collective-memory/scripts/research_sync.js`
- Test: `collective-memory/scripts/research_sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractDocumentSignals } = require('./research_sync');

test('extractDocumentSignals finds citations and theory markers', () => {
  const result = extractDocumentSignals('Marco teórico\n(Goffman, 1959)\nDatos reutilizados de la entrevista');
  assert.ok(result.citations.includes('Goffman, 1959'));
  assert.ok(result.theoryTerms.includes('marco teórico'));
  assert.ok(result.dataTerms.includes('datos'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: FAIL because `extractDocumentSignals` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

Add a reusable signal extractor that parses prose from `.md` and `.docx` text into citations, theory markers, data markers, headings, and recurring terms.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add collective-memory/scripts/research_sync.js collective-memory/scripts/research_sync.test.js
git commit -m "feat: deepen research sync evidence extraction"
```

### Task 2: Add optional LLM narrative generation with local fallback

**Files:**
- Modify: `collective-memory/scripts/research_sync.js`
- Test: `collective-memory/scripts/research_sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('buildLocalDescription produces prose from shared evidence', () => {
  const description = buildLocalDescription({
    fromName: 'Project A',
    toName: 'Project B',
    sharedSummary: ['theoretical_frameworks: fenomenología'],
    docFiles: ['nota.md'],
    docSignals: { citations: ['Goffman, 1959'], dataTerms: ['datos'] },
  });

  assert.match(description, /fenomenología/);
  assert.match(description, /Goffman/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: FAIL until the narrative helper is implemented and exported.

- [ ] **Step 3: Write minimal implementation**

Add `buildLocalDescription()` and an optional OpenAI-backed `buildLLMDescription()` that returns a richer paragraph when `OPENAI_API_KEY` is available, while preserving the existing `description` field contract.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test collective-memory/scripts/research_sync.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add collective-memory/scripts/research_sync.js collective-memory/scripts/research_sync.test.js
git commit -m "feat: add optional LLM connection prose"
```

### Task 3: Update workflow docs and status notes

**Files:**
- Modify: `collective-memory-skill/SKILL.md`
- Modify: `README.md`
- Modify: `STATUS.md`

- [ ] **Step 1: Write the failing test**

No automated test; verify the updated wording manually against the new behavior.

- [ ] **Step 2: Run verification commands**

Run: `rg -n "/memoria strengthen|research_sync|docx|LLM" collective-memory-skill/SKILL.md README.md STATUS.md`
Expected: Each file reflects the new deep-document and optional LLM behavior.

- [ ] **Step 3: Write minimal implementation**

Update the command docs so `/memoria strengthen` mentions actual `.md` and `.docx` inspection, and `STATUS.md` no longer lists the fallback as pending.

- [ ] **Step 4: Run verification commands**

Run: `rg -n "/memoria strengthen|research_sync|docx|LLM" collective-memory-skill/SKILL.md README.md STATUS.md`
Expected: The new wording is present in all three files.

- [ ] **Step 5: Commit**

```bash
git add collective-memory-skill/SKILL.md README.md STATUS.md
git commit -m "docs: describe strengthened research sync workflow"
```
