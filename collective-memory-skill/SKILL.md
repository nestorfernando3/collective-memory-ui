---
name: collective-memory
description: An AI-agnostic collective memory system that catalogs research, projects, and personal knowledge into a centralized filesystem database. Allows agents to find synergies, generate cross-project profiles, and manage portfolios.
tags: [knowledge-management, memory, orchestration, portfolio]
version: 1.0.0
---

# Collective Memory Skill

This skill transforms the user's local filesystem into an active, interrogable graph of their life's work.
Instead of relying on LLM context windows or disjointed chats, a central database (`~/.collective-memory` by default, configurable by the user) stores structured JSON metadata about the user's unified identity, their projects, and the relationships between those projects. The default mode is systemwide: it works across the full memory graph unless the user explicitly narrows the scope.

When using this skill, your role as an AI assistant is to act as a **librarian and data synthesizer** for the user's work. You have access to your usual environment tools (file reading, writing, shell access) which you will use to manage this data.

## 🚀 Uso Guiado

Cuando ejecutes este Skill, acompaña siempre la respuesta con tres datos concretos:
1. La ruta exacta de la carpeta raíz que quedó generada o actualizada.
2. Los archivos clave que contiene esa carpeta.
3. El siguiente paso para usarla dentro de la plataforma.

La carpeta que se importa en la UI es la **raíz del snapshot**, no un JSON suelto. Por defecto esa raíz vive en `~/.collective-memory/`, aunque el usuario esté trabajando desde un proyecto concreto.

Los archivos que la plataforma espera ver dentro de esa carpeta son:
- `README.md` - Índice humano del snapshot, generado por `/memoria build-readme`.
- `profile.json` - Perfil unificado del usuario.
- `connections.json` - Grafo de relaciones entre proyectos.
- `projects/` - Carpeta con un archivo `[project-id].json` por proyecto.

Si el usuario pregunta “¿qué archivo uso en la plataforma?”, la respuesta debe ser:
- importa la **carpeta raíz completa**
- si necesitas un punto de entrada para abrir y revisar el snapshot, usa `README.md`

## 📚 Comandos y Recomendaciones

Cuando el usuario pida orientación sobre qué comando ejecutar, responde con una tabla corta y concreta. Prioriza el comando más útil según la intención:

| Comando | Qué hace | Recomendación |
| --- | --- | --- |
| `/memoria scan` | Detecta proyectos nuevos o incompletos en el filesystem. | Úsalo antes de registrar nada nuevo o cuando hayas creado carpetas recientes. |
| `/memoria register [path]` | Convierte una carpeta en una ficha estructurada de proyecto. | Úsalo para proyectos nuevos, carpetas borrador o notas sueltas que merecen estructura. |
| `/memoria profile` | Regenera `profile.json` y `PROFILE.md` con tu identidad unificada. | Ejecútalo después de registrar varios proyectos o si cambió tu foco de trabajo. |
| `/memoria connections` | Recalcula el grafo de relaciones entre proyectos. | Úsalo cuando quieras ver sinergias, cruces temáticos o reutilización de trabajo previo. |
| `/memoria build-readme` | Regenera el índice humano `README.md` del snapshot. | Úsalo justo antes de importar la carpeta en la UI o cuando quieras un índice legible. |
| `/memoria collect` | Ejecuta el flujo completo: scan, register, profile, connections, build-readme y research sync. | Es la mejor opción cuando quieres dejar todo actualizado en una sola pasada. |
| `/memoria strengthen [file_path]` | Usa la memoria previa para fortalecer un documento o app actual. | Úsalo al redactar artículos, propuestas o documentos que necesiten justificaciones y vínculos más ricos. Por defecto cruza toda la base de memoria; usa foco explícito solo si quieres acotarlo. |

Si el usuario no especifica un comando, ejecuta `/memoria collect` por defecto y luego reporta el resultado. Usa `/memoria strengthen` solo cuando ya haya un documento abierto y el usuario pida reforzarlo.

## 💾 The Data Layer

The default data directory is `~/.collective-memory/` (or whatever path the user specifies in their setup or prompt). The normal operating mode is systemwide across the full memory graph, not limited to the currently active project unless the user asks for that.
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
5. If a project already exists but its card is terse, flag it for richer re-registration rather than skipping it.

### `/memoria register [path]`
**Goal:** Extract metadata from a project directory and save it as a structured JSON card.
**Action:**
1. Inspect the provided directory to understand its purpose (read files, code, docs).
2. Generate a comprehensive JSON summarizing the project. Ensure you capture: `id, name, type, status, path, description, themes, outputs, technologies, theoretical_frameworks`.
3. When the source material supports it, also capture `abstract, objectives, methodology, evidence, related_projects, crossovers, expansion_ideas, notes, collaborators, institutions, dates`.
4. If the directory has only terse notes, inspect README files, docs, notebooks, articles, or code comments and synthesize a richer structured card from that evidence.
5. Save the JSON file into the `projects/` database directory.
6. Print a summary of the registered project.

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

### `/memoria collect`
**Goal:** Run the full memory refresh in a single pass.
**Action:**
1. Run `/memoria scan` to identify new or stale projects.
2. Run `/memoria register` on any new projects and on terse cards that need richer structure.
3. Run `/memoria profile` to regenerate the unified profile and `PROFILE.md`.
4. Run `/memoria connections` to refresh synergies and the graph.
5. Run `/memoria build-readme` to regenerate the portfolio index.
6. Run the local `research_sync` workflow to strengthen existing links, inspect real `.md` and `.docx` prose when metadata is insufficient, and apply validated new or refreshed descriptions when appropriate.
7. Report the refreshed graph, any newly added projects, and any remaining evidence gaps that still need manual review.
8. Close with the exact root folder path that the user should import into the platform and list the files that live there.

### `/memoria build-readme`
**Goal:** Generate the "Collective Memory" portfolio document.
**Action:**
1. Read `profile.json`, `projects/*.json`, and `connections.json`.
2. Generate a comprehensive `README.md` (saved in the database root directory, e.g. `~/.collective-memory/README.md`) that serves as the index of the user's life work. Include a Mermaid.js graph of the project connections.
3. Tell the user that `README.md` is the human-readable index, but the platform import target is still the **folder root** containing that file.

### `/memoria strengthen [file_path]`
**Goal:** Use past work to strengthen a current document or application.
**Action:**
1. Read the target document (e.g. an academic article, or a grant proposal).
2. Search through the memory database (`projects/`) for past projects, data, models, or literature reviews that match the themes of the current document.
3. If the metadata is too thin, inspect the actual prose inside nearby `.md` and `.docx` sources to recover theoretical matrices, repeated citations, shared data, and structural motifs.
4. Propose specific, actionable additions to the target document based on the recovered history. By default, search the full memory system; only narrow to one project or path when the user explicitly requests it. Offer to edit the document with prose-rich justifications instead of only formal link summaries.

---

## 🛑 Operating Principles (The "Gstack" Approach)

1. **Boil the Lake**: Never just return a short chat response if a permanent artifact is better. When asked to evaluate projects, write to the filesystem, update the `README.md`, or modify the JSON files directly. Do the complete implementation.
2. **System Agnostic Structure**: Your code and data modifications must remain in standard JSON and Markdown. This ensures the database is readable regardless of which AI platform the user is operating within (e.g., Anthropic Claude, OpenAI Codex, or Antigravity).
3. **Voice Consistency**: Always adhere to the user's unique voice and context. Read `profile.json` (specifically the `voice_profile` key or the linked `master_prompt_path`) before generating any user-facing text or portfolio documentation.
