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

/**
 * Aggressive manual-chunk splitting keeps the initial bundle small and caches
 * well across deploys.
 *
 * Order matters: more specific matchers run first. A permissive `react`
 * matcher previously swallowed every package with "react" in its name
 * (`react-error-boundary`, `react-router-dom`, `react-hook-form`, …), which
 * ballooned `react-vendor` to ~700 KB.
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return

  // --- highly-used vendor chunks we want to isolate so they cache well ---
  if (id.includes('@sentry/')) return 'sentry';
  if (id.includes('@supabase/')) return 'supabase';
  if (id.includes('@tanstack/')) return 'tanstack-query';
  if (id.includes('@radix-ui/')) return 'radix';
  if (id.includes('@phosphor-icons') || id.includes('lucide-react')) return 'icons';
  if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'framer-motion';
  if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts';
  if (id.includes('three') || id.includes('@react-three')) return 'three';
  if (id.includes('mapbox-gl') || id.includes('supercluster') || id.includes('kdbush')) return 'mapbox';
  if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-') || id.includes('micromark') || id.includes('unified') || id.includes('mdast-') || id.includes('hast-')) return 'markdown';
  if (id.includes('date-fns') || id.includes('dayjs')) return 'dates';
  if (id.includes('sonner')) return 'sonner';
  if (id.includes('octokit') || id.includes('@octokit')) return 'octokit';
  if (id.includes('@vercel/')) return 'vercel';
  if (id.includes('localforage') || id.includes('idb-keyval') || id.includes('idb/')) return 'storage';
  if (id.includes('zod') || id.includes('@hookform') || id.includes('react-hook-form')) return 'forms';
  if (id.includes('@github/spark')) return 'spark';

  // --- React runtime (narrow matcher — only the React packages themselves) ---
  if (
    id.includes('/node_modules/react/') ||
    id.includes('/node_modules/react-dom/') ||
    id.includes('/node_modules/scheduler/') ||
    id.includes('/node_modules/react-is/')
  ) {
    return 'react-vendor';
  }

  // --- Router sits on top of React and changes rarely; keep separate ---
  if (id.includes('react-router')) return 'router';
  if (id.includes('react-error-boundary')) return 'error-boundary';

  // Everything else (mostly tiny utility deps) lands in the default chunk.
  return undefined;
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  return {
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
      // Tight ceiling so that accidentally ballooning a chunk is loud in CI.
      // Lifted to 300 kB because mapbox + react-vendor legitimately land near
      // the 250-kB line; anything over 300 kB is a regression worth a PR
      // comment.
      chunkSizeWarningLimit: 300,
    },
    plugins: [
      !isVitest && react(),
      tailwindcss(),
      // Dev-only: the icon proxy rewrites imports for non-existent icons to a
      // fallback (`Question`). Not needed in production.
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
          // Keep precache lean: don't ship stale spark proxies, source maps,
          // or the giant map/sentry/three mega-chunks — they're only needed
          // on specific routes and are fetched on demand.
          globIgnores: [
            '**/proxy.js',
            '**/mapbox-*.js',
            '**/mapbox-gl-*.js',
            '**/maplibre-gl-*.js',
            '**/three-*.js',
            '**/sentry-*.js',
            '**/*.map',
          ],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB cap
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/pulses.*/i,
              handler: 'NetworkOnly',
              method: 'POST',
              options: {
                backgroundSync: {
                  name: 'pulse-sync-queue',
                  options: {
                    maxRetentionTime: 24 * 60, // Retry for max 24 hours
                  },
                },
              },
            },
          ],
        },
      }) as PluginOption,
    ].filter(Boolean) as PluginOption[],
    resolve: {
      alias: {
        '@': resolve(projectRoot, 'src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      testTimeout: 10000,
      exclude: ['e2e/**', 'tests/**', 'node_modules/**', 'dist/**', '.claude/worktrees/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'json-summary'],
        include: ['src/lib/**'],
        exclude: [
          'src/lib/**/__tests__/**',
          'src/lib/**/*.test.ts',
          'src/lib/**/*.test.tsx',
        ],
        thresholdAutoUpdate: false,
        thresholds: {
          // Starting floor based on today's actual src/lib coverage.
          // Set ~2% below current to allow small legitimate refactors.
          // Raised by Wave 3e after +193 tests (actuals ~58/53/61/58).
          statements: 35,
          branches: 33,
          functions: 42,
          lines: 34,
        },
      },
    },
  }
});
