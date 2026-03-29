# 🧠 Collective Memory

**An interactive graph visualization of your research portfolio, projects, and creative work.**

Collective Memory renders your entire professional universe as an orbital map — you at the center, your projects orbiting around you, connected by the relationships you define. Built with an **Editorial Brutalist** aesthetic that rejects generic AI design tropes.

![Editorial Brutalism](https://img.shields.io/badge/Design-Editorial_Brutalism-1A1A1A?style=flat-square) ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square) ![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square) ![Deploy](https://img.shields.io/badge/Deploy-GitHub_Pages-222?style=flat-square)

---

## ⚡ Quick Start (5 minutes)

### 1. Fork & Clone

```bash
# Fork this repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/collective-memory-ui.git
cd collective-memory-ui
npm install
```

### 2. Add Your Data

All your data lives in `public/data/`. Edit three files:

#### `profile.json` — Your identity
```json
{
  "name": "Jane Doe",
  "site_title": "Research Universe",
  "site_subtitle": "PhD Candidate · MIT Media Lab",
  "affiliations": [
    { "institution": "MIT Media Lab", "role": "PhD Candidate", "current": true }
  ],
  "lenses": [
    { "id": "All", "label": "Everything", "filter": [] },
    { "id": "AI", "label": "AI Research", "filter": ["machine-learning", "nlp", "ai"] },
    { "id": "Art", "label": "Creative Work", "filter": ["art", "installation", "creative"] }
  ]
}
```

#### `projects/*.json` — One file per project
```json
{
  "id": "my-thesis",
  "name": "Attention Mechanisms in Music Generation",
  "type": "Research",
  "status": "In Progress",
  "description": "Exploring transformer architectures for real-time music composition.",
  "tags": ["machine-learning", "music", "ai"]
}
```

#### `connections.json` — Links between projects
```json
{
  "connections": [
    { "from": "my-thesis", "to": "music-vae", "type": "Builds On" }
  ]
}
```

#### `projects_index.json` — List of project filenames
```
my-thesis.json
music-vae.json
art-installation.json
```

> **Tip:** See `public/data/example.profile.json` and `public/data/example.project.json` for complete field references.

### 3. Preview Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and see your universe.

### 4. Deploy to GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Push to `main`:

```bash
git add .
git commit -m "Add my data"
git push origin main
```

Your site will be live at `https://YOUR_USERNAME.github.io/collective-memory-ui/` within ~2 minutes.

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

---

## 📁 Data Schema

### `profile.json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Your name (displayed on center node) |
| `site_title` | string | — | Page header title (defaults to `name`) |
| `site_subtitle` | string | — | Page header subtitle (defaults to first affiliation role) |
| `affiliations` | array | — | Your institutional roles |
| `lenses` | array | — | Filter views (see Lenses section) |
| `domains` | array | — | Your areas of expertise |
| `identifiers` | object | — | ORCID, GitHub, Scholar IDs |

### `projects/*.json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique ID (must match filename without `.json`) |
| `name` | string | ✅ | Display name |
| `type` | string | — | Category (Research, Creative, EdTech, etc.) |
| `status` | string | — | Current state (Active, Complete, Submitted, etc.) |
| `description` | string | — | Short description |
| `abstract` | string | — | Longer summary (shown in drawer) |
| `tags` | array | — | Used for lens filtering |
| `path` | string | — | Local filesystem path (optional) |

### Lenses

Lenses let you filter the graph by tag. Define them in `profile.json`:

```json
{
  "lenses": [
    { "id": "All", "label": "Everything", "filter": [] },
    { "id": "Research", "label": "Research Only", "filter": ["research", "paper", "thesis"] }
  ]
}
```

- `filter: []` (empty) → shows all projects
- `filter: ["tag1", "tag2"]` → shows only projects whose tags match any of these

---

## 🚀 Deploying Elsewhere

### Netlify / Vercel
Just connect your repo. No config needed — the default `./` base path works out of the box.

### Custom Base Path
If deploying to a subpath (e.g., `example.com/portfolio/`):

```bash
VITE_BASE_PATH=/portfolio/ npm run build
```

---

## 🛠 Tech Stack

- **React 19** + **Vite 6** — fast dev, instant HMR
- **@xyflow/react** — graph rendering engine
- **Lucide React** — icon system
- **Vanilla CSS** — no Tailwind, no utility classes. Hand-crafted brutalism

---

## License

MIT — use it, fork it, make it yours.
