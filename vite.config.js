import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves this project below /my-3d-scroll-based-website/.
  // Relative asset URLs keep the build portable locally and on Pages.
  base: './',
});
