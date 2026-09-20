import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// @ts-ignore
import { liveRepositoryPlugin } from "./vite-live-plugin.js";

export default defineConfig({
  plugins: [react(), liveRepositoryPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});

