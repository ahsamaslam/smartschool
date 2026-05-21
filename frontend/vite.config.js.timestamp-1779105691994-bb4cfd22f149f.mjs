// vite.config.js
import path from "node:path";
import os from "node:os";
import { defineConfig } from "file:///C:/Users/Lenovo/Documents/Smart%20School/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Lenovo/Documents/Smart%20School/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var viteCacheDir = path.join(os.tmpdir(), "smartschool-frontend-vite-cache");
var vite_config_default = defineConfig({
  cacheDir: viteCacheDir,
  plugins: [react()],
  server: {
    port: 3e3,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true
      }
    }
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
      "clsx"
    ]
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
            "@heroicons/react/24/solid"
          ],
          // Charts — only loaded on dashboard pages
          "vendor-charts": ["recharts"],
          // Video player — only loaded on video pages
          "vendor-player": ["react-player"],
          // HTTP client
          "vendor-axios": ["axios"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxMZW5vdm9cXFxcRG9jdW1lbnRzXFxcXFNtYXJ0IFNjaG9vbFxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcTGVub3ZvXFxcXERvY3VtZW50c1xcXFxTbWFydCBTY2hvb2xcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0xlbm92by9Eb2N1bWVudHMvU21hcnQlMjBTY2hvb2wvZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XHJcbmltcG9ydCBvcyBmcm9tIFwibm9kZTpvc1wiO1xyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XHJcblxyXG4vLyBLZWVwIFZpdGUncyBjYWNoZSBPVVQgb2YgT25lRHJpdmUgXHUyMDE0IEVQRVJNIG9mdGVuIGhhcHBlbnMgd2hlbiBzeW5jIGxvY2tzIG5vZGVfbW9kdWxlcy8udml0ZVxyXG5jb25zdCB2aXRlQ2FjaGVEaXIgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIFwic21hcnRzY2hvb2wtZnJvbnRlbmQtdml0ZS1jYWNoZVwiKTtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgY2FjaGVEaXI6IHZpdGVDYWNoZURpcixcclxuXHJcbiAgcGx1Z2luczogW3JlYWN0KCldLFxyXG5cclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDAsXHJcbiAgICBwcm94eToge1xyXG4gICAgICBcIi9hcGlcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcblxyXG4gIC8vIFByZS1idW5kbGUgaGVhdnkgZGVwcyBpbiBkZXYgc28gdGhleSBkb24ndCBjb21waWxlIG9uLWRlbWFuZFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogW1xyXG4gICAgICBcInJlYWN0XCIsXHJcbiAgICAgIFwicmVhY3QtZG9tXCIsXHJcbiAgICAgIFwicmVhY3Qtcm91dGVyLWRvbVwiLFxyXG4gICAgICBcInJlYWN0LXBsYXllclwiLFxyXG4gICAgICBcInJlY2hhcnRzXCIsXHJcbiAgICAgIFwiQGhlYWRsZXNzdWkvcmVhY3RcIixcclxuICAgICAgXCJAaGVyb2ljb25zL3JlYWN0LzI0L291dGxpbmVcIixcclxuICAgICAgXCJAaGVyb2ljb25zL3JlYWN0LzI0L3NvbGlkXCIsXHJcbiAgICAgIFwiYXhpb3NcIixcclxuICAgICAgXCJyZWFjdC1ob3QtdG9hc3RcIixcclxuICAgICAgXCJjbHN4XCIsXHJcbiAgICBdLFxyXG4gIH0sXHJcblxyXG4gIGJ1aWxkOiB7XHJcbiAgICAvLyBSYWlzZSB3YXJuaW5nIHRocmVzaG9sZCAocmVjaGFydHMgKyByZWFjdC1wbGF5ZXIgYXJlIGxlZ2l0aW1hdGVseSBsYXJnZSlcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNjAwLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgIC8vIENvcmUgUmVhY3QgcnVudGltZSBcdTIwMTQgY2FjaGVkIGZvcmV2ZXIsIHJhcmVseSBjaGFuZ2VzXHJcbiAgICAgICAgICBcInZlbmRvci1yZWFjdFwiOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0LXJvdXRlci1kb21cIl0sXHJcbiAgICAgICAgICAvLyBVSSB1dGlsaXRpZXNcclxuICAgICAgICAgIFwidmVuZG9yLXVpXCI6IFtcIkBoZWFkbGVzc3VpL3JlYWN0XCIsIFwiY2xzeFwiLCBcInJlYWN0LWhvdC10b2FzdFwiXSxcclxuICAgICAgICAgIC8vIEljb25zIFx1MjAxNCBsYXJnZSBidXQgc3RhdGljXHJcbiAgICAgICAgICBcInZlbmRvci1pY29uc1wiOiBbXHJcbiAgICAgICAgICAgIFwiQGhlcm9pY29ucy9yZWFjdC8yNC9vdXRsaW5lXCIsXHJcbiAgICAgICAgICAgIFwiQGhlcm9pY29ucy9yZWFjdC8yNC9zb2xpZFwiLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgIC8vIENoYXJ0cyBcdTIwMTQgb25seSBsb2FkZWQgb24gZGFzaGJvYXJkIHBhZ2VzXHJcbiAgICAgICAgICBcInZlbmRvci1jaGFydHNcIjogW1wicmVjaGFydHNcIl0sXHJcbiAgICAgICAgICAvLyBWaWRlbyBwbGF5ZXIgXHUyMDE0IG9ubHkgbG9hZGVkIG9uIHZpZGVvIHBhZ2VzXHJcbiAgICAgICAgICBcInZlbmRvci1wbGF5ZXJcIjogW1wicmVhY3QtcGxheWVyXCJdLFxyXG4gICAgICAgICAgLy8gSFRUUCBjbGllbnRcclxuICAgICAgICAgIFwidmVuZG9yLWF4aW9zXCI6IFtcImF4aW9zXCJdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZVLE9BQU8sVUFBVTtBQUM5VixPQUFPLFFBQVE7QUFDZixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFdBQVc7QUFHbEIsSUFBTSxlQUFlLEtBQUssS0FBSyxHQUFHLE9BQU8sR0FBRyxpQ0FBaUM7QUFHN0UsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsVUFBVTtBQUFBLEVBRVYsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBRWpCLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdBLGNBQWM7QUFBQSxJQUNaLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxPQUFPO0FBQUE7QUFBQSxJQUVMLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQTtBQUFBLFVBRVosZ0JBQWdCLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBO0FBQUEsVUFFekQsYUFBYSxDQUFDLHFCQUFxQixRQUFRLGlCQUFpQjtBQUFBO0FBQUEsVUFFNUQsZ0JBQWdCO0FBQUEsWUFDZDtBQUFBLFlBQ0E7QUFBQSxVQUNGO0FBQUE7QUFBQSxVQUVBLGlCQUFpQixDQUFDLFVBQVU7QUFBQTtBQUFBLFVBRTVCLGlCQUFpQixDQUFDLGNBQWM7QUFBQTtBQUFBLFVBRWhDLGdCQUFnQixDQUFDLE9BQU87QUFBQSxRQUMxQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
