import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path can be overridden via env for GitHub Pages project sites.
// For a user/org page or custom domain, set VITE_BASE=/ (the default).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
});
