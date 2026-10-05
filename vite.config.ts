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
          if (id.includes("node_modules")) {
            if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+)[\\/]/.test(id)) {
              return "vendor-charts";
            }
            if (/[\\/]node_modules[\\/]framer-motion[\\/]/.test(id)) {
              return "vendor-motion";
            }
            if (/[\\/]node_modules[\\/](@xyflow|dagre)[\\/]/.test(id)) {
              return "vendor-flow";
            }
            if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) {
              return "vendor-supabase";
            }
            if (/[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/.test(id)) {
              return "vendor-ui";
            }
            if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom|@tanstack[\\/]react-query|zustand)[\\/]/.test(id)) {
              return "vendor-react";
            }
          }
        },
      },
    },
  },
}));
