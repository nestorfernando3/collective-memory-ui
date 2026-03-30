# Changelog

## Unreleased - 2026-03-30

### Changed
- Connection text cleanup now lives in a shared helper used by both `connectionInsights` and `profileNarrative`, so sanitization rules stop drifting between the graph card and the profile narrative.
- Added focused tests for legacy noisy prose cleanup and generic-bridge detection, and ignored `/.context/` so local retro snapshots do not dirty the repo.
- `research_sync.js` now chooses document search roots by host platform instead of assuming a single folder layout.
- Default document scanning covers common macOS, Linux, and Windows locations, with `--documents-root` available for explicit overrides.
- The workspace README now explains the platform-aware search behavior.
- Connection descriptions and skill guidance now use clearer, more natural Spanish instead of internal labels like `shared tokens` or field names such as `theoretical_frameworks`.
- 2026-03-30 (`455a53a`): regenerated the connection graph so existing narratives also use the clearer Spanish copy.
- The collective-memory skill now forces a brief onboarding preamble before execution on every activation so users see scope, root path, and the next recommended step.
- The collective-memory skill now defaults to `/memoria collect` when no command is specified, instead of pausing for a follow-up question.
- The default snapshot root is now documented and created as a visible folder at `~/Documents/Collective Memory/` instead of a hidden dot-directory.
- The skill and UI now expose `/memoria systemwide` as the explicit “work across all memory” command.
- The installed collective-memory skill version is now `1.1.0`.
- The collective-memory UI now has a global connections toggle, clickable edges that open a connection drawer, and a project drawer that surfaces principal connections first.
- Lenses are now dynamic: empty lenses are hidden, and type-based lenses are generated from the currently visible project set.
- The browser smoke test now verifies the project connection list, the connection visibility toggle, and the connection drawer flow.
- The local memory snapshot now keeps `Archivo vivo de trabajo` as platform metadata and trims the biography/profile summary so it reads as prose instead of a repeated label dump.
- The collective-memory UI is now bilingual in English and Spanish, and the published docs have been normalized to English.
- The collective-memory skill docs now require a brief onboarding before execution and keep the default `/memoria collect` fallback explicit.
- The installed collective-memory skill version is now `1.2.0`.

### Simplified
- The UI onboarding copy was shortened so new users can understand the snapshot flow faster.
- The README guidance now highlights the `systemwide` default more clearly.
- The skill now behaves as a mini onboarding step and explains what each `/memoria` command does when activated.
- Project drawers now start with the strongest connections, with a switch to reveal the full list when needed.
- The lens row no longer shows filters that do not match any visible projects.

### Verified
- `node --test collective-memory/scripts/research_sync.test.js`
- `npm run build` in `collective-memory-ui`
- `node --test collective-memory-ui/src/lib/*.test.js`
- `npm run smoke` in `collective-memory-ui`
