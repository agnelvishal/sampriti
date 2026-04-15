import { defineConfig } from 'vite';
import { resolve } from 'path';
import { globSync } from 'glob';
import { ViteMinifyPlugin } from 'vite-plugin-minify';

// Find all HTML files in the project, excluding node_modules and dist
const htmlFiles = globSync(['**/*.html'], { 
  ignore: ['node_modules/**', 'dist/**', 'package.json', 'package-lock.json'] 
});

const input = {};
htmlFiles.forEach(file => {
  // Create a unique key for each HTML file
  const name = file.replace(/\.html$/, '').replace(/\//g, '_');
  input[name] = resolve(__dirname, file);
});

export default defineConfig({
  root: './',
  plugins: [
    ViteMinifyPlugin({}),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input,
    },
  },
});
