# Research Sync Strengthening and Narrative Enrichment Spec

**Goal:** Upgrade `/memoria strengthen` so it can recover evidence from real `.md` and `.docx` prose and optionally rewrite connection descriptions with richer explanatory prose for the UI.

**Architecture:** `research_sync.js` remains the orchestrator. It will gain a deeper evidence extractor for document prose, citation and theory overlap detection, and an optional LLM-backed narrative generator that falls back to a deterministic local description builder when credentials are absent or the API fails.

**Tech Stack:** Node.js, filesystem traversal, `unzip` for DOCX extraction, optional OpenAI Chat Completions API via HTTPS, JSON/Markdown reports.

---

## Scope

- Improve project-to-project scoring with actual prose evidence from `.md` and `.docx` files.
- Detect shared theoretical matrices, repeated citations, and data reuse signals from documents.
- Generate richer connection descriptions for the UI without changing the existing `connections.json` contract.
- Keep those descriptions in clear, natural Spanish and avoid exposing internal field names or English jargon in user-facing copy.
- Keep the LLM path optional and safe through a deterministic fallback.

## Non-Goals

- No new database format.
- No change to the React UI data contract.
- No requirement for a specific LLM provider beyond optional OpenAI support.

## Behavior

- Existing metadata-based scoring continues to work.
- Document scanning now extracts:
  - citation strings
  - theory and method markers
  - headings and recurring phrases
  - data reuse vocabulary
- The report shows evidence from both metadata and prose.
- When applying changes, the script may enrich descriptions for newly accepted or refreshable connections.
- When LLM credentials are unavailable, the script emits a local prose description based on the same evidence.

## Acceptance Criteria

- `/memoria strengthen` can cite concrete prose evidence from `.md` and `.docx` sources.
- `research_sync.js` can produce richer descriptions without network access.
- `connections.json` remains compatible with the UI.
- The workflow still succeeds when no LLM key is configured.
