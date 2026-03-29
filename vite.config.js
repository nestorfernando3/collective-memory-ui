import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Reads the repo name from package.json for GitHub Pages subpath deploys.
// Set VITE_BASE_PATH env var to override, or leave empty for root deploys (Netlify/Vercel).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || './',
})
