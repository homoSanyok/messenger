import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  publicDir: 'public',
  base: '/messenger/',
  build: {
    assetsDir: 'assets',
    outDir: 'dist',
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
});
