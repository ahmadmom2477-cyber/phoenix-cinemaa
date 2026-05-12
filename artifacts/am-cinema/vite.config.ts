import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const isProduction = process.env.NODE_ENV === "production";

// PORT is only required for dev server — not needed during `vite build`
const port = Number(process.env.PORT ?? "5000");

// BASE_PATH defaults to "/" which is correct for production
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  define: {
    global: "globalThis",
  },
  plugins: [
    nodePolyfills({ include: ["events", "buffer", "stream", "util", "process"] }),
    react(),
    tailwindcss(),
    ...(!isProduction ? [runtimeErrorOverlay()] : []),
    ...(!isProduction && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      "bittorrent-dht": path.resolve(import.meta.dirname, "src/stubs/bittorrent-dht.ts"),
      "bittorrent-lsd": path.resolve(import.meta.dirname, "src/stubs/empty.ts"),
      "load-ip-set": path.resolve(import.meta.dirname, "src/stubs/empty.ts"),
      "ut_pex": path.resolve(import.meta.dirname, "src/stubs/empty.ts"),
      "@silentbot1/nat-api": path.resolve(import.meta.dirname, "src/stubs/empty.ts"),
    },
    dedupe: ["react", "react-dom"],
    browserField: true,
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":  ["react", "react-dom"],
          "vendor-query":  ["@tanstack/react-query"],
          "vendor-motion": ["framer-motion"],
          "vendor-router": ["wouter"],
          "vendor-ui":     ["lucide-react"],
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  },
});
