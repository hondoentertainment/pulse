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
export default defineConfig(({ command }) => ({
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (!normalizedId.includes('/node_modules/')) return

          // Phosphor ships its entire icon set under `@phosphor-icons/react`.
          // Match it BEFORE the generic react check below (whose `/react/`
          // substring would otherwise swallow the ~600 kB icon module into
          // react-vendor).
          if (normalizedId.includes('/@phosphor-icons/')) {
            return 'icons-vendor'
          }
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }
          if (normalizedId.includes('/react-router/') || normalizedId.includes('/react-router-dom/')) {
            return 'router-vendor'
          }
          if (normalizedId.includes('/framer-motion/')) {
            return 'motion-vendor'
          }
          if (normalizedId.includes('/@radix-ui/')) {
            return 'radix-vendor'
          }
          if (normalizedId.includes('/@tanstack/') || normalizedId.includes('/@supabase/')) {
            return 'data-vendor'
          }
          // Heavy, route-specific libs — keep them out of the main index chunk so
          // first paint doesn't pay for charts / maps / 3d that most routes skip.
          if (normalizedId.includes('/recharts/') || normalizedId.includes('/d3-') || normalizedId.includes('/d3/')) {
            return 'charts-vendor'
          }
          if (normalizedId.includes('/mapbox-gl/') || normalizedId.includes('/maplibre-gl/') || normalizedId.includes('/supercluster/')) {
            return 'map-vendor'
          }
          if (normalizedId.includes('/three/')) {
            return 'three-vendor'
          }
          if (normalizedId.includes('/react-hook-form/') || normalizedId.includes('/@hookform/') || normalizedId.includes('/zod/')) {
            return 'forms-vendor'
          }
          if (normalizedId.includes('/@sentry/')) {
            return 'sentry-vendor'
          }
          if (normalizedId.includes('/@vercel/analytics')) {
            return 'vercel-analytics'
          }
        },
      },
    },
  },
  plugins: [
    !isVitest && react(),
    tailwindcss(),
    // DO NOT REMOVE — dev-only; emits ~1.5 MB proxy.js that must not ship in prod precache.
    command === 'serve' && (createIconImportProxy() as PluginOption),
    command === 'serve' && (sparkPlugin() as PluginOption),
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
        globIgnores: [
          '**/proxy.js',
          '**/mapbox-gl-*.js',
          '**/maplibre-gl-*.js',
          '**/*.map',
        ],
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
    exclude: ['e2e/**', 'tests/**', 'node_modules/**', 'dist/**'],
  },
}))
