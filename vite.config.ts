/// <reference types="vitest" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { VitePWA } from 'vite-plugin-pwa'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname
const isVitest = process.env.VITEST === 'true'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  return {
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return
          // IMPORTANT: specific package matches MUST come before generic `react`/`react-dom`
          // so that packages with "react" in their name (e.g. @phosphor-icons/react,
          // react-hook-form, react-day-picker) don't get pulled into react-vendor.
          // Keep phosphor isolated as a vendor chunk so route chunks stay small
          // and browsers get long-term caching. Without this, the `react-vendor`
          // chunk balloons to ~500 kB because the generic react matcher catches
          // `@phosphor-icons/react/*` too.
          if (id.includes('@phosphor-icons')) return 'phosphor'
          if (id.includes('framer-motion')) return 'framer-motion'
          if (id.includes('recharts') || id.includes('/d3-') || id.endsWith('/d3')) return 'charts'
          if (id.includes('/three/') || id.includes('/three\\')) return 'three'
          if (id.includes('@radix-ui/')) return 'radix'
          if (id.includes('/sonner/')) return 'sonner'
          if (id.includes('@tanstack/react-query')) return 'tanstack-query'
          if (id.includes('octokit') || id.includes('@octokit')) return 'octokit'
          if (id.includes('@supabase/')) return 'supabase'
          if (id.includes('@sentry/')) return 'sentry'
          if (id.includes('@vercel/')) return 'vercel'
          if (id.includes('mapbox-gl')) return 'mapbox-gl'
          // Keep react runtime isolated — must be the LAST check so it doesn't swallow
          // react-adjacent packages above.
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    !isVitest && react(),
    tailwindcss(),
    // DO NOT REMOVE
    // Dev-only: the icon proxy rewrites imports for non-existent icons to a
    // fallback (`Question`). It is not needed in production builds where
    // Vite's normal tree-shaking/error handling is preferred.
    isDev ? (createIconImportProxy() as PluginOption) : null,
    // Dev-only: `sparkPlugin()` emits a 1.5 MB `proxy.js` runtime wrapper
    // into `dist/` and only makes sense inside the GitHub Spark workbench.
    // Gating it to `command === 'serve'` keeps Spark features during local
    // dev while stopping the proxy from shipping to production.
    isDev ? (sparkPlugin() as PluginOption) : null,
    ViteImageOptimizer({
      jpg: { quality: 75 },
      png: { quality: 80 },
      webp: { quality: 80 },
    }) as PluginOption,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // Utilizing existing public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Keep precache lean: don't ship stale spark proxies, source maps, or
        // the maplibre/mapbox mega-chunks in the precache — they're only
        // needed when the map is actually opened and are fetched on demand.
        globIgnores: [
          '**/proxy.js',
          '**/mapbox-gl-*.js',
          '**/maplibre-gl-*.js',
          '**/*.map',
        ],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }) as PluginOption,
  ].filter(Boolean) as PluginOption[],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 10000,
    exclude: ['e2e/**', 'tests/**', 'node_modules/**', 'dist/**'],
  },
  }
});
