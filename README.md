# Collective Memory Workspace

This repository now acts as the umbrella workspace for the Collective Memory project.

## What lives where

- `collective-memory-ui/` is the interactive graph app. It is its own git repository.
- `collective-memory/` is the workspace-local memory database, scripts, and configuration.
- `collective-memory-skill/` holds the skill docs that describe the `/memoria` workflows.

## Quick Start

- Open the UI repo and run `npm install` once, then `npm run dev`.
- Keep project cards and graph data in `collective-memory/`.
- Use `/memoria collect` for a full refresh: scan, register, profile, connections, build-readme, and research sync in one pass.
- Use `collective-memory/scripts/sync.sh` to push data into the UI repo.
- Use `collective-memory/scripts/research_sync.js` to rank and draft project connections from metadata and local notes.

## Useful Links

- UI repo README: [collective-memory-ui/README.md](/Users/nestor/Documents/ReMember2/collective-memory-ui/README.md)
- UI setup wizard: [collective-memory-ui/init_memory.sh](/Users/nestor/Documents/ReMember2/collective-memory-ui/init_memory.sh)
- Workspace status: [STATUS.md](/Users/nestor/Documents/ReMember2/STATUS.md)
