// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import pruneUnusedAssets from "./integrations/prune-unused-assets.mjs";

const SITE = "https://portfolio.cardamone-online.ch";

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "always",
  // CSS intégré dans chaque page : aucune requête bloquant le premier affichage
  build: { format: "directory", inlineStylesheets: "always" },
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      // La page 404 n'a rien à faire dans le plan du site.
      filter: (page) => !page.startsWith(`${SITE}/404`),
    }),
    pruneUnusedAssets(),
  ],
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Anton",
      cssVariable: "--font-display",
      display: "swap",
      fallbacks: ["Impact", "Arial Narrow", "sans-serif"],
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/anton-400.woff2"],
            weight: "400",
            style: "normal",
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Instrument Sans",
      cssVariable: "--font-body",
      display: "swap",
      fallbacks: ["Helvetica Neue", "Arial", "sans-serif"],
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/instrument-sans-wght.woff2"],
            weight: "400 700",
            style: "normal",
          },
        ],
      },
    },
  ],
});
