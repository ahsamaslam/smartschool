import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },

  // Pre-bundle heavy deps in dev so they don't compile on-demand
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "react-player",
      "recharts",
      "@headlessui/react",
      "@heroicons/react/24/outline",
      "@heroicons/react/24/solid",
      "axios",
      "react-hot-toast",
      "clsx",
    ],
  },

  build: {
    // Raise warning threshold (recharts + react-player are legitimately large)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached forever, rarely changes
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // UI utilities
          "vendor-ui": ["@headlessui/react", "clsx", "react-hot-toast"],
          // Icons — large but static
          "vendor-icons": [
            "@heroicons/react/24/outline",
            "@heroicons/react/24/solid",
          ],
          // Charts — only loaded on dashboard pages
          "vendor-charts": ["recharts"],
          // Video player — only loaded on video pages
          "vendor-player": ["react-player"],
          // HTTP client
          "vendor-axios": ["axios"],
        },
      },
    },
  },
});
