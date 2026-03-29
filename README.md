# 🧠 Collective Memory Framework

**An interactive graph visualization of your research portfolio, projects, and creative work.**

Collective Memory renders your entire professional universe as an orbital map — you at the center, your projects orbiting around you, connected by the relationships you define. Built with an **Editorial Brutalist** aesthetic that rejects generic AI design tropes.

---

## ⚡ Onboarding: Build Your Own Memory

**The Philosophy:** Your data stays local. The code is public.
This interface is designed to let people build a private memory database, load it from their own machine, and keep the last imported snapshot in the browser with IndexedDB. When the browser supports it, the user can explicitly authorize a local folder and the app will re-read that folder automatically on revisit and while the tab remains active. The repository ships with a demo memory, but your uploaded memory replaces it for that browser only.

Follow these steps to launch your own universe:

### 1. Install the skill
Install or activate the `collective-memory` skill in your agent environment, then use it to gather your data:
```bash
/memoria scan
/memoria register [path]
/memoria profile
/memoria connections
```
Those commands should produce the folder you will import into the app.

### 2. Clone the Interface
Clone this UI template to your computer:
```bash
git clone https://github.com/YOUR_USERNAME/collective-memory-ui.git
cd collective-memory-ui
npm install
```

### 3. Prepare your Memory Folder
Create a private folder anywhere on your computer (for example `~/Documents/My-Memory/`) and keep the exported memory there.

The folder should contain:
- `profile.json` (Who you are and your filters/lenses)
- `connections.json` (How your projects relate to each other)
- `projects/` (A folder with one `.json` file per project)

*(Not sure how to structure them? View `public/data/example.profile.json` and `example.project.json` in this repository for the exact schemas).*

### 4. Open the App and Authorize or Upload
Start the local server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) and choose one of the two flows:

- **Autorizar carpeta y sincronizar** if your browser supports the File System Access API. This keeps a folder handle in the browser and auto-syncs the latest JSON files from that folder.
- **Importar carpeta local** if you just want a one-time snapshot. The app will parse the folder, render the graph, and keep the last imported memory on this browser.

In both cases the graph is restored from the last successful import on revisit.

Once the graph is loaded:
- Click the central node to open an extensive persona bio built from your profile, projects, and graph connections.
- Open any project node to inspect its summary, tags, and a persistent action to exclude or restore it from the visible selection.
- Run `npm run smoke` to verify the browser flow locally before shipping changes.

### 5. Publish When Ready
When you are ready to publish, keep personal data outside the repository and deploy only the app shell. The included GitHub Pages workflow is configured to build the site from the tracked files.

---

## 🏛 Design Philosophy

This isn't another dashboard. It's a **brutalist research map**.

| Element | Choice | Why |
|---------|--------|-----|
| Typography | Space Grotesk + Lora | High-contrast heading/body pairing that reads like a printed journal |
| Colors | Paper `#F2EFE9` + Ink `#1A1A1A` | No gradients, no neon — just material honesty |
| Shadows | Hard offset (4px solid) | Depth without blur. Every element has weight |
| Accents | Single red `#E63946` | Used surgically for active states and connections |
| Shapes | Zero border-radius | Boxes are boxes. No pill buttons, no circles |

## 🛠 Tech Stack
- **React 19** + **Vite 8**
- **@xyflow/react** — graph rendering engine
- **Lucide React** — icon system
- **IndexedDB** — local persistence for the last uploaded memory
- **File System Access API** — authorized local-folder sync when the browser supports it
- **Playwright** — browser smoke for the onboarding, profile drawer, and exclusion flow
- **Vanilla CSS** — Hand-crafted brutalism

## License
MIT — use it, fork it, deploy it, make it yours.
