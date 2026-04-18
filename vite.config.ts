import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname
const isVitest = process.env.VITEST === 'true'
const isAnalyze = process.env.ANALYZE === 'true'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('scheduler')) return 'react-vendor';
            if (id.includes('react-dom')) return 'react-vendor';
            if (id.includes('/react/')) return 'react-vendor';
            if (id.includes('framer-motion')) return 'framer-motion';
            if (id.includes('recharts') || id.includes('/d3') || id.includes('d3-') || id.includes('visx')) return 'charts';
            if (id.includes('three')) return 'three';
            if (id.includes('@radix-ui/')) return 'radix';
            if (id.includes('sonner')) return 'sonner';
            if (id.includes('@tanstack/react-query')) return 'tanstack-query';
            if (id.includes('@phosphor-icons')) return 'phosphor';
            if (id.includes('octokit') || id.includes('@octokit')) return 'octokit';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    !isVitest && react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
    isAnalyze &&
      visualizer({
        filename: "stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
      }) as PluginOption,
  ].filter(Boolean) as PluginOption[],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
