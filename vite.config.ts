import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/node_modules/')) {
            if (
              normalized.includes('/node_modules/react/') ||
              normalized.includes('/node_modules/react-dom/') ||
              normalized.includes('/node_modules/react-router/') ||
              normalized.includes('/node_modules/react-router-dom/')
            ) {
              return 'vendor-react';
            }
            if (normalized.includes('/@supabase/')) {
              return 'vendor-supabase';
            }
            if (normalized.includes('/@tanstack/')) {
              return 'vendor-query';
            }
            if (
              normalized.includes('/@radix-ui/') ||
              normalized.includes('/lucide-react/') ||
              normalized.includes('/class-variance-authority/') ||
              normalized.includes('/clsx/') ||
              normalized.includes('/tailwind-merge/')
            ) {
              return 'vendor-ui';
            }
            if (normalized.includes('/framer-motion/')) {
              return 'vendor-motion';
            }
            if (normalized.includes('/recharts/') || normalized.includes('/d3-')) {
              return 'vendor-charts';
            }
            if (normalized.includes('/@xyflow/') || normalized.includes('/dagre/')) {
              return 'vendor-flow';
            }
          }
        },
      },
    },
  },
}));
