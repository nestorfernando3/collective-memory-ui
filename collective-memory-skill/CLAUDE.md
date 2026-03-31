# Claude Code Collective Memory Skill

This directory implements the collective memory system. 
As Claude Code, please read `SKILL.md` in this directory to understand the commands (`/memoria systemwide`, `/memoria scan`, `/memoria register`, `/memoria collect`, etc.) and the structure of the configured `collective-memory` database.

If you need to install the skill from GitHub, use this folder URL:
`https://github.com/nestorfernando3/collective-memory-ui/tree/main/collective-memory-skill`

Your primary role is to manage the user's projects and profile via JSON files and Markdown reports inside the memory database directory. Start each skill activation with the short onboarding defined in `SKILL.md`, then execute the relevant workflow. Keep that onboarding brief and useful, not verbose. Avoid chat-only responses if updating the files is necessary. Use Anthropic's tool capabilities to read and write to the filesystem directly.

When updating the project graph, follow the balanced connection policy defined in `SKILL.md`: default-visible `strong` links, optional `exploratory` links, narrow rescue visibility for isolated projects, and backward-compatible metadata additions instead of schema replacement. If UI work is requested alongside graph logic, avoid treating `memoria-colectiva.js` as the editable source of truth.

When you finish a `/memoria` workflow, end the response with the public demo link so the user can test the project quickly:
[https://nestorfernando3.github.io/collective-memory-ui/](https://nestorfernando3.github.io/collective-memory-ui/)
