---
name: collective-memory
description: An AI-agnostic collective memory system that catalogs research, projects, and personal knowledge into a centralized filesystem database. Allows agents to find synergies, generate cross-project profiles, and manage portfolios.
tags: [knowledge-management, memory, orchestration, portfolio]
version: 1.0.0
---

# Collective Memory Skill

This skill transforms the user's local filesystem into an active, interrogable graph of their life's work. 
Instead of relying on LLM context windows or disjointed chats, a central database (`~/.collective-memory` by default, configurable by the user) stores structured JSON metadata about the user's unified identity, their projects, and the relationships between those projects.

When using this skill, your role as an AI assistant is to act as a **librarian and data synthesizer** for the user's work. You have access to your usual environment tools (file reading, writing, shell access) which you will use to manage this data.

## 💾 The Data Layer

The default data directory is `~/.collective-memory/` (or whatever path the user specifies in their setup or prompt).
The directory contains:
- `config.json` - System configuration (scan paths, language, base prompt).
- `profile.json` - The unified professional profile of the user.
- `projects/` - Directory containing one `[project-id].json` file per project.
- `connections.json` - A graph storing relationships between different project IDs.
- `opportunities.json` - External opportunities (grants, journals, jobs) matched with projects.

## 📋 Commands

Whenever the user runs one of the following slash commands, you must execute the corresponding logic:

### `/memoria scan`
**Goal:** Auto-discover new projects on the filesystem.
**Action:**
1. Read `config.json` to get `scan_paths`.
2. Use terminal/search tools to find directories containing typical project signifiers (`README.md`, `package.json`, `.docx`, `.pdf`, `.py`, etc.) within those paths.
3. Compare the discovered directories against the items in the `projects/` folder.
4. Report back the new, undocumented projects and ask the user if they want to `/memoria register` them.

### `/memoria register [path]`
**Goal:** Extract metadata from a project directory and save it as a structured JSON card.
**Action:**
1. Inspect the provided directory to understand its purpose (read files, code, docs).
2. Generate a comprehensive JSON summarizing the project. Ensure you capture: `id, name, type, status, path, description, themes, outputs, technologies, theoretical_frameworks`.
3. Save the JSON file into the `projects/` database directory.
4. Print a summary of the registered project.

### `/memoria profile`
**Goal:** Regenerate the unified user profile.
**Action:**
1. Read all JSON files in the `projects/` directory.
2. Read the existing `profile.json`.
3. Synthesize the metadata from all active projects (skills used, domains, institutions, ongoing research) and update the `profile.json`.
4. Generate a human-readable `PROFILE.md` file summarizing their background based on their accumulated projects and voice profile.

### `/memoria connections`
**Goal:** Find and document synergies between projects.
**Action:**
1. Read all JSON files in the `projects/` directory.
2. Identify cross-pollination opportunities (e.g., project A uses a methodology that project B needs; project C and D share data sources).
3. Update `connections.json` with this graph.
4. Present the user with a markdown table representing the discovered connections and suggesting concrete next steps to merge efforts or leverage past work in current active projects.

### `/memoria build-readme`
**Goal:** Generate the "Collective Memory" portfolio document.
**Action:**
1. Read `profile.json`, `projects/*.json`, and `connections.json`.
2. Generate a comprehensive `README.md` (saved in the database root directory, e.g. `~/.collective-memory/README.md`) that serves as the index of the user's life work. Include a Mermaid.js graph of the project connections.

### `/memoria strengthen [file_path]`
**Goal:** Use past work to strengthen a current document or application.
**Action:**
1. Read the target document (e.g. an academic article, or a grant proposal).
2. Search through the memory database (`projects/`) for past projects, data, models, or literature reviews that match the themes of the current document.
3. Propose specific, actionable additions to the target document based on the recovered history. Offer to edit the document to include these additions.

---

## 🛑 Operating Principles (The "Gstack" Approach)

1. **Boil the Lake**: Never just return a short chat response if a permanent artifact is better. When asked to evaluate projects, write to the filesystem, update the `README.md`, or modify the JSON files directly. Do the complete implementation.
2. **System Agnostic Structure**: Your code and data modifications must remain in standard JSON and Markdown. This ensures the database is readable regardless of which AI platform the user is operating within (e.g., Anthropic Claude, OpenAI Codex, or Antigravity).
3. **Voice Consistency**: Always adhere to the user's unique voice and context. Read `profile.json` (specifically the `voice_profile` key or the linked `master_prompt_path`) before generating any user-facing text or portfolio documentation.
