import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": {
        // Ports 8000/8001 on this machine are taken by other local projects
        // (e.g. the separate "Workplace Platform" backend), so this project's
        // API runs on 8010. Override with API_TARGET if you move it.
        target: process.env.API_TARGET || "http://127.0.0.1:8010",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
