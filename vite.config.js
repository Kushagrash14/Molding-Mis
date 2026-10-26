import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          xlsx: ["xlsx"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT || 5000}`,
        changeOrigin: true,
      },
    },
  },
});
