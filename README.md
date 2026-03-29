# 🧠 Collective Memory Framework

**An interactive graph visualization of your research portfolio, projects, and creative work.**

Collective Memory renders your entire professional universe as an orbital map — you at the center, your projects orbiting around you, connected by the relationships you define. Built with an **Editorial Brutalist** aesthetic that rejects generic AI design tropes.

---

## ⚡ Onboarding: Build Your Own Memory

**The Philosophy:** Your data is private. The code is public. 
This framework is designed so you can maintain a secret local database of JSON/Markdown files with your life's work, and automatically compile it into a stunning web portfolio—**without ever committing your personal data to the source code.** To protect you, this repository explicitly ignores personal data tracking via `.gitignore`.

Follow these clear steps to launch your own universe:

### 1. Clone the Framework
Clone this generic User Interface template to your computer:
```bash
git clone https://github.com/YOUR_USERNAME/collective-memory-ui.git
cd collective-memory-ui
npm install
```

### 2. Prepare your Secret Database
The `public/data` folder in this repository is ignored by Git by design. 
Create a completely separate folder anywhere on your computer (e.g., `~/Documents/My-Memory/`) to act as your private database.

Inside your private folder, create the following structure:
- `profile.json` (Who you are and your filters/lenses)
- `connections.json` (How your projects relate to each other)
- `projects/` (A folder with one `.json` file per project)

*(Not sure how to structure them? View `public/data/example.profile.json` and `example.project.json` in this repository for the exact schemas).*

### 3. Sync and Test Locally
Copy your private JSON files into the interface to see how they look. You can do this manually, or create a simple sync script that copies your private folder contents into `collective-memory-ui/public/data/`.

Once the data is in `public/data/`, start the local server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) and see your universe.

### 4. Deploy to GitHub Pages (The Secure Way)
When you are ready to publish your portfolio, **do not commit your data to the `main` branch**. 

Instead, compile a final version and push *only* the static website to a special `gh-pages` branch using these commands:
```bash
# Compile the website and your data into a production 'dist' folder
npm run build

# Push ONLY the compiled folder to a hidden gh-pages branch
npx --yes gh-pages -d dist -t true -m "Deploying Collective Memory update"
```

**Final step on GitHub:**
1. Go to your repository **Settings** → **Pages**.
2. Under **Source**, select **Deploy from a branch**.
3. Select the **`gh-pages`** branch and save.

Your site will be live at `https://YOUR_USERNAME.github.io/collective-memory-ui/` within a few minutes!

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
- **React 19** + **Vite 6**
- **@xyflow/react** — graph rendering engine
- **Lucide React** — icon system
- **Vanilla CSS** — Hand-crafted brutalism

## License
MIT — use it, fork it, deploy it, make it yours.
