import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 5180,
  },
  build: {
    target: ["es2020", "safari14"],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@react-pdf")) return "react-pdf";
          if (id.includes("pdfjs-dist")) return "pdf-viewer";
          if (id.includes("jspdf")) return "jspdf";
          if (id.includes("html2canvas")) return "html2canvas";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "rich-text";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@dnd-kit") || id.includes("@tanstack")) return "workspace";
          if (id.includes("@radix-ui")) return "ui-radix";
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) return "react-vendor";
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    // Le service worker precachait index.html et tous les bundles, alors que
    // l'application desactive deja son enregistrement (__BATIPRO_DISABLE_SW__).
    // Resultat : qui l'avait installe avant restait bloque sur une version
    // ancienne, et un deploiement n'arrivait jamais jusqu'a lui.
    //
    // selfDestroying produit un service worker qui desinstalle le precedent et
    // vide ses caches. Le navigateur verifie /sw.js de lui-meme a chaque
    // navigation : les postes bloques se debloquent seuls, sans vidage manuel.
    // A supprimer une fois que plus personne ne porte l'ancien.
    VitePWA({
      manifest: false,
      injectRegister: false,
      selfDestroying: true,
    }),
  ],
});
