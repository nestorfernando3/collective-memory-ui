# Codex Collective Memory Skill

This file teaches the Codex agent how to interact with the collective-memory database. 
Read the full system instructions in `SKILL.md` located in this directory. 

Whenever the user references `/memoria`, refer to the `SKILL.md` rules. Ensure you generate JSON representations of projects exactly as specified and use local system commands to verify and alter the overarching portfolio graph (`~/Documents/Collective Memory/connections.json` and similar files by default, unless the user configured another root). Start every activation with the short onboarding required by `SKILL.md`, then execute. If the user does not specify a command, run `/memoria collect` by default after that onboarding. Output structural changes (reports, updated READMEs) using tool edits rather than simply pasting them in the chat.
