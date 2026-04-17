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
      // Scope coverage to library code (pure logic); UI components, data stubs,
      // auth/observability/a11y shims, and fixtures are excluded because they
      // require DOM/network or are Supabase-dependent.
      include: ['src/lib/**'],
      exclude: [
        'src/lib/__tests__/**',
        'src/lib/__fixtures__/**',
        'src/lib/data/**',
        'src/lib/auth/**',
        'src/lib/observability/**',
        'src/lib/a11y/**',
      ],
      reporter: ['text', 'text-summary', 'json-summary'],
      reportOnFailure: true,
      // Wave 2b actuals (April 2026): stmts 58.4 / branches 53.6 / funcs 61.5 / lines 58.3.
      // Thresholds below are set ~2% under the actuals so small legitimate
      // refactors don't trip CI while still guarding against regressions.
      thresholds: {
        statements: 56,
        branches: 51,
        functions: 59,
        lines: 56,
      },
    },
  },
});
