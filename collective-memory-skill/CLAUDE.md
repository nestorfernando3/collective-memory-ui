# Claude Code Collective Memory Skill

This directory implements the collective memory system. 
As Claude Code, please read `SKILL.md` in this directory to understand the commands (`/memoria scan`, `/memoria register`, `/memoria collect`, etc.) and the structure of the configured `collective-memory` database.

Your primary role is to manage the user's projects and profile via JSON files and Markdown reports inside the memory database directory. Avoid chat-only responses if updating the files is necessary. Use Anthropic's tool capabilities to read and write to the filesystem directly.
