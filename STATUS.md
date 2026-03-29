# Collective Memory UI Status
**Updated:** 2026-03-29

## Completed
- UI build and lint are green.
- The app now starts with an in-screen onboarding rail that explains the skill install and upload flow.
- Local folder uploads are parsed into `profile.json`, `connections.json`, and `projects/*.json`.
- The last uploaded memory is persisted in the browser with IndexedDB and auto-restored on revisit.
- Demo memory still ships with the repo so the graph is visible before a user uploads their own snapshot.

## Next
- Browser QA on the upload/restore flow and the stacked mobile layout.

## Key Paths
- App: `src/App.jsx`
- Parser: `src/lib/memoryBundle.js`
- Storage: `src/lib/memoryStore.js`
- Styling: `src/index.css`
