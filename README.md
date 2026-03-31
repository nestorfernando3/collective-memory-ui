# Collective Memory Workspace

This repository now acts as the umbrella workspace for the Collective Memory project.

## What lives where

- `collective-memory-ui/` is the interactive graph app. It is its own git repository.
- `collective-memory/` is the workspace-local memory database, scripts, and configuration.
- `collective-memory-skill/` holds the skill docs that describe the `/memoria` workflows.

## Quick Start

- Open the UI repo and run `npm install` once, then `npm run dev`.
- The UI defaults to English and includes a header toggle for English and Spanish.
- Keep project cards and graph data in `collective-memory/`.
- Use `/memoria collect` for a full refresh: scan, register, profile, connections, build-readme, and research sync in one pass.
- Use `/memoria systemwide` when you want to make the global scope explicit from the start and refresh the full memory root.
- Use `collective-memory/scripts/sync.sh` to push data into the UI repo.
- Use `collective-memory/scripts/research_sync.js` to rank and draft project connections from metadata, local notes, and fallback `.md`/`.docx` prose, with optional LLM-enriched connection justifications. By default it scans the full memory system; its document search adapts to the host platform, using common roots for macOS, Linux, and Windows. Pass `--focus <project-id>` only when you want a single-project pass, `--documents-root` if you want to override the default roots, and `--engine v2 --report-json tmp/connection-report.json` when you want a rollout summary for comparison. Set `OPENAI_NARRATIVE_MODEL` or `OPENAI_MODEL` to tune the prose generator.

## Copy Style

- The project should use clear, natural Spanish in system copy, project notes, and generated connection descriptions.
- Prefer ordinary phrases like `se basa en`, `comparte`, `se entiende por`, and `palabras compartidas` over internal labels or English jargon.
- When a technical term is necessary, explain it in the same sentence with plain wording.
- Avoid exposing internal field names such as `shared tokens` or `theoretical_frameworks` in user-facing text.

## Command Guide

| Command | What it does | Recommendation |
| --- | --- | --- |
| `/memoria systemwide` | Makes the full-memory scope explicit and refreshes the whole root. | Use it when you want a novice-safe default that clearly means “work across all my memory,” not just the active project. |
| `/memoria scan` | Finds new or missing projects in the filesystem. | Run it first when you add new folders or want to check what has not been registered yet. |
| `/memoria register [path]` | Converts one folder into a structured project card. | Use it for a new project, a thesis folder, a paper, or any folder with enough evidence to describe. |
| `/memoria profile` | Regenerates the unified profile and `PROFILE.md`. | Run it after registering a batch of projects or when your working identity has changed. |
| `/memoria connections` | Rebuilds the project graph and cross-project synergies. | Use it when you want to surface reuse, bridges, and shared methods across projects. |
| `/memoria build-readme` | Recreates the human-readable index of the snapshot. | Run it before importing the folder into the UI so the root folder has a clear entry point. |
| `/memoria collect` | Runs the full memory refresh in one pass. | Best default when you want everything updated together. |
| `/memoria strengthen [file_path]` | Strengthens a current document using the memory database. | Use it for active writing so the document gets richer justifications, related history, and evidence-backed links. It searches the whole system unless you explicitly narrow the focus. |

Default snapshot root: `~/Documents/Collective Memory/`
Default scope: systemwide across the full memory graph unless you explicitly narrow it.

## Useful Links

- UI repo README: [collective-memory-ui/README.md](/Users/nestor/Documents/ReMember2/collective-memory-ui/README.md)
- UI setup wizard: [collective-memory-ui/init_memory.sh](/Users/nestor/Documents/ReMember2/collective-memory-ui/init_memory.sh)
- Workspace status: [STATUS.md](/Users/nestor/Documents/ReMember2/STATUS.md)
