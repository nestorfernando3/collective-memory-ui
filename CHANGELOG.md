# Changelog

## Unreleased - 2026-03-29

### Changed
- `research_sync.js` now chooses document search roots by host platform instead of assuming a single folder layout.
- Default document scanning covers common macOS, Linux, and Windows locations, with `--documents-root` available for explicit overrides.
- The workspace README now explains the platform-aware search behavior.

### Simplified
- The UI onboarding copy was shortened so new users can understand the snapshot flow faster.
- The README guidance now highlights the `systemwide` default more clearly.

### Verified
- `node --test collective-memory/scripts/research_sync.test.js`
- `npm run build` in `collective-memory-ui`
