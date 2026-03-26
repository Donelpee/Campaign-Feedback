import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean,
  ),
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
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("exceljs")) return "excel-export";
          if (id.includes("recharts")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          if (
            id.includes("@radix-ui") ||
            id.includes("lucide-react") ||
            id.includes("embla-carousel-react") ||
            id.includes("vaul") ||
            id.includes("cmdk")
          ) {
            return "ui-vendor";
          }
          return undefined;
        },
      },
    },
  },
}));
