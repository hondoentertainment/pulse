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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (!normalizedId.includes('/node_modules/')) return

          if (normalizedId.includes('/react/') || normalizedId.includes('/react-dom/')) {
            return 'react-vendor'
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
          if (normalizedId.includes('/@sentry/') || normalizedId.includes('/@vercel/')) {
            return 'observability'
          }
        },
      },
    },
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
    environment: 'node',
    exclude: ['e2e/**', 'tests/**', 'node_modules/**', 'dist/**'],
  },
});
