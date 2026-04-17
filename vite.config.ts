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
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
            if (id.includes('framer-motion')) return 'framer-motion';
            if (id.includes('recharts') || id.includes('d3')) return 'charts';
            if (id.includes('three')) return 'three';
            if (id.includes('@radix-ui/')) return 'radix';
            if (id.includes('sonner')) return 'sonner';
            if (id.includes('@tanstack/react-query')) return 'tanstack-query';
            if (id.includes('@phosphor-icons')) return 'phosphor';
            if (id.includes('octokit') || id.includes('@octokit')) return 'octokit';
            if (id.includes('@supabase/')) return 'supabase';
            if (id.includes('@sentry/')) return 'sentry';
            if (id.includes('@vercel/')) return 'vercel';
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
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/pulses.*/i,
            handler: 'NetworkOnly',
            method: 'POST',
            options: {
              backgroundSync: {
                name: 'pulse-sync-queue',
                options: {
                  maxRetentionTime: 24 * 60 // Retry for max 24 Hours
                }
              }
            }
          }
        ]
      }
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      // Scope to src/lib for now — our strongest coverage area.
      // Expand in a future wave as we add tests for components/hooks.
      include: ['src/lib/**'],
      exclude: [
        'src/lib/**/__tests__/**',
        'src/lib/**/*.test.ts',
        'src/lib/**/*.test.tsx',
      ],
      // Starting thresholds: realistic lower bound today, with a TODO to
      // raise them as coverage improves. Do NOT auto-update on green runs —
      // any regression should fail CI and be noticed.
      thresholdAutoUpdate: false,
      thresholds: {
        // Starting floor based on today's actual src/lib coverage:
        // stmts 37.5%, branches 35.7%, funcs 44.7%, lines 36.6%.
        // Set ~2% below current to allow small legitimate refactors.
        // TODO(wave-2d): raise to 50%+ once more lib modules gain tests.
        statements: 35,
        branches: 33,
        functions: 42,
        lines: 34,
      },
    },
  },
});
