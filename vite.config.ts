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

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isVitest = process.env.VITEST === 'true'
  const isDev = command === 'serve' && !isVitest

  return {
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/')
            if (!normalizedId.includes('/node_modules/')) return

            // Phosphor first: `@phosphor-icons/react/dist/...` contains `/react/`
            // and used to leak ~300 KB into react-vendor.
            if (normalizedId.includes('/@phosphor-icons/')) {
              return 'phosphor'
            }
            // Sentry must stay on its own async chunk. Sharing a name with the
            // statically imported `@vercel/analytics` module pulled the SDK
            // onto Signal first paint.
            if (normalizedId.includes('/@sentry/')) {
              return 'sentry'
            }
            if (normalizedId.includes('/@vercel/')) {
              return 'observability'
            }
            if (normalizedId.includes('/framer-motion/')) {
              return 'motion-vendor'
            }
            if (normalizedId.includes('/@radix-ui/')) {
              return 'radix-vendor'
            }
            if (normalizedId.includes('/@tanstack/')) {
              return 'query-vendor'
            }
            if (normalizedId.includes('/@supabase/')) {
              return 'supabase'
            }
            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor'
            }
          },
        },
      },
    },
    plugins: [
      !isVitest && react(),
      tailwindcss(),
      // Icon proxy + Spark workbench plugins are serve-only. Shipping them in
      // `vite build` re-emits dist/proxy.js (~1.5 MB) into the PWA precache.
      (isDev || isVitest) && (createIconImportProxy() as PluginOption),
      isDev && (sparkPlugin() as PluginOption),
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
          importScripts: ['/signal-push-sw.js'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: [
            '**/proxy.js',
            '**/package.json',
            '**/*mapbox-gl*.js',
            '**/*maplibre-gl*.js',
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
                    maxRetentionTime: 24 * 60, // Retry for max 24 Hours
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
      exclude: ['e2e/**', 'tests/**', 'node_modules/**', 'dist/**'],
    },
  }
})
