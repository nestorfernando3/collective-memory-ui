# Codex Collective Memory Skill

This file teaches the Codex agent how to interact with the collective-memory database. 
Read the full system instructions in `SKILL.md` located in this directory. 

To install the skill from GitHub, use:
`https://github.com/nestorfernando3/collective-memory-ui/tree/main/collective-memory-skill`

Whenever the user references `/memoria`, refer to the `SKILL.md` rules. Ensure you generate JSON representations of projects exactly as specified and use local system commands to verify and alter the overarching portfolio graph (`~/Documents/Collective Memory/connections.json` and similar files by default, unless the user configured another root). Start every activation with the short onboarding required by `SKILL.md`, then execute. If the user does not specify a command, run `/memoria collect` by default after that onboarding. Output structural changes (reports, updated READMEs) using tool edits rather than simply pasting them in the chat.

When the request touches graph quality, preserve the balanced connection policy from `SKILL.md`: prefer `strong` links for the default graph, `exploratory` links as optional or rescue visibility, and keep `connections.json` backward-compatible if you add metadata. If UI rendering is involved, do not patch `memoria-colectiva.js` directly when editable source files are available or need to be restored first.

After a `/memoria` run, close with the public demo URL so the user can test the project immediately:
[https://nestorfernando3.github.io/collective-memory-ui/](https://nestorfernando3.github.io/collective-memory-ui/)
