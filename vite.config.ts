import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    target: ["es2020", "safari14"],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@react-pdf")) {
            return "react-pdf";
          }
          if (id.includes("pdfjs-dist")) {
            return "pdf-viewer";
          }
          if (id.includes("jspdf")) {
            return "jspdf";
          }
          if (id.includes("html2canvas")) {
            return "html2canvas";
          }
          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts";
          }
          if (id.includes("@tiptap") || id.includes("prosemirror")) {
            return "rich-text";
          }
          if (id.includes("@supabase")) {
            return "supabase";
          }
          if (id.includes("@dnd-kit") || id.includes("@tanstack")) {
            return "workspace";
          }
          if (id.includes("@radix-ui")) {
            return "ui-radix";
          }
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      manifest: false,
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
      ],
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
