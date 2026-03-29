# Changelog

## Unreleased - 2026-03-29

### Changed
- `research_sync.js` now chooses document search roots by host platform instead of assuming a single folder layout.
- Default document scanning covers common macOS, Linux, and Windows locations, with `--documents-root` available for explicit overrides.
- The workspace README now explains the platform-aware search behavior.
- The collective-memory skill now defaults to `/memoria collect` when no command is specified, instead of pausing for a follow-up question.
- The default snapshot root is now documented and created as a visible folder at `~/Documents/Collective Memory/` instead of a hidden dot-directory.
- The skill and UI now expose `/memoria systemwide` as the explicit “work across all memory” command.
- The installed collective-memory skill version is now `1.1.0`.

### Simplified
- The UI onboarding copy was shortened so new users can understand the snapshot flow faster.
- The README guidance now highlights the `systemwide` default more clearly.
- The skill now behaves as a mini onboarding step and explains what each `/memoria` command does when activated.

### Verified
- `node --test collective-memory/scripts/research_sync.test.js`
- `npm run build` in `collective-memory-ui`
