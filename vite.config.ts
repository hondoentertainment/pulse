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
          if (!id.includes('node_modules')) return;

          // Keep react-vendor lean: only React core + ReactDOM
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-error-boundary/') ||
            id.includes('/scheduler/')
          ) return 'react-vendor';

          // Sentry — lazy-loaded at runtime, keep isolated
          if (id.includes('@sentry/')) return 'sentry';

          // Framer-motion — lazy route transitions, keep separate
          if (id.includes('framer-motion')) return 'framer-motion';

          // Three.js — 3D visualizations, only pulled in when used
          if (id.includes('/three/') || id.includes('three-')) return 'three';

          // Charts — analytics/insights pages only
          if (id.includes('recharts') || id.includes('/d3') || id.includes('d3-')) return 'charts';

          // Radix UI primitives — loaded per sub-page
          if (id.includes('@radix-ui/')) return 'radix';

          // Supabase client
          if (id.includes('@supabase/')) return 'supabase';

          // TanStack Query
          if (id.includes('@tanstack/')) return 'tanstack-query';

          // Vercel observability
          if (id.includes('@vercel/')) return 'vercel';

          // Phosphor icons — large icon set, own chunk
          if (id.includes('@phosphor-icons')) return 'phosphor';

          // Octokit / GitHub SDK
          if (id.includes('octokit') || id.includes('@octokit')) return 'octokit';

          // Toast notifications
          if (id.includes('sonner') || id.includes('vaul')) return 'ui-overlays';
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
      // Aggressive mobile-friendly settings
      jpg: { quality: 70, progressive: true },
      jpeg: { quality: 70, progressive: true },
      png: { quality: 70, compressionLevel: 9 },
      webp: { quality: 72, effort: 6 },
      avif: { quality: 60, effort: 9 },
      svg: {
        plugins: [
          { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
          { name: 'removeXMLNS' },
        ],
      },
    }) as PluginOption,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // Utilizing existing public/manifest.json
      workbox: {
        // Only precache the app shell: HTML, core CSS/JS, and essential fonts.
        // Everything else (route chunks, images, API) uses runtime caching.
        globPatterns: [
          '**/*.{html,css}',
          // Core entry chunks only – react-vendor, tanstack-query, main index
          'assets/react-vendor-*.js',
          'assets/tanstack-query-*.js',
          'assets/index-*.js',
        ],
        // Ensure heavy chunks are NOT precached (they'll be fetched on demand)
        globIgnores: [
          'assets/sentry-*.js',
          'assets/three-*.js',
          'assets/charts-*.js',
          'assets/framer-motion-*.js',
          'assets/radix-*.js',
          'assets/octokit-*.js',
        ],
        runtimeCaching: [
          // Offline-safe background sync for pulse creation POSTs
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/pulses.*/i,
            handler: 'NetworkOnly',
            method: 'POST',
            options: {
              backgroundSync: {
                name: 'pulse-sync-queue',
                options: {
                  maxRetentionTime: 24 * 60, // 24 hours
                },
              },
            },
          },
          // Supabase REST reads: network-first, 10 s timeout, fallback to cache
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
            },
          },
          // Static assets from CDN / external origins: stale-while-revalidate
          {
            urlPattern: /^https:\/\/(cdn\.|api\.dicebear\.com|images\.unsplash\.com).*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          // Route-split JS/CSS chunks: stale-while-revalidate so non-core routes
          // load instantly after first visit without bloating the precache
          {
            urlPattern: /\/assets\/(sentry|three|charts|framer-motion|radix|octokit|phosphor)-.*\.(js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lazy-chunks',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
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
    environment: 'node',
    exclude: ['e2e/**', 'tests/**', 'node_modules/**', 'dist/**'],
  },
});
