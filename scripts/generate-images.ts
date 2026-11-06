/**
 * Génère, en local, l'image de partage (1200 × 630) et les icônes temporaires
 * à partir de site.ts et des polices du site. Aucune donnée n'est envoyée
 * à l'extérieur. Usage : npm run generate:images
 *
 * Fichiers produits (dans public/) :
 *  - og-image.png          image de partage Open Graph
 *  - favicon-32.png        icône d'onglet (temporaire, remplaçable par un logo)
 *  - apple-touch-icon.png  icône d'écran d'accueil (180 × 180)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { ROOT } from "./lib.ts";
import { site } from "../src/config/site.ts";

const font = (file: string) =>
  `data:font/woff2;base64,${readFileSync(path.join(ROOT, "src/assets/fonts", file)).toString("base64")}`;

const FONTS = `
  @font-face { font-family: Anton; src: url(${font("anton-400.woff2")}) format("woff2"); }
  @font-face { font-family: Instrument; src: url(${font("instrument-sans-wght.woff2")}) format("woff2"); font-weight: 400 700; }
  * { margin: 0; box-sizing: border-box; }
`;

const [prenom, ...reste] = site.name.toUpperCase().split(" ");

const OG = `<!doctype html><html><head><style>${FONTS}
  body { width: 1200px; height: 630px; background: #F2F0EB; color: #111110; position: relative; overflow: hidden; }
  /* Le nom (4,56 em de large pour CARDAMONE) ne touche jamais l'aplat */
  .slab { position: absolute; top: 0; right: 0; width: 240px; height: 630px; background: #6B0F1A; }
  .name { position: absolute; left: 64px; top: 70px; font-family: Anton; font-size: 176px; line-height: 1.02; }
  .role { position: absolute; left: 68px; bottom: 64px; width: 700px; font-family: Instrument; font-weight: 600; font-size: 34px; line-height: 1.2; }
  .rule { position: absolute; left: 68px; bottom: 160px; width: 740px; height: 3px; background: #111110; }
</style></head><body>
  <div class="slab"></div>
  <div class="name">${prenom}<br>${reste.join(" ")}</div>
  <div class="rule"></div>
  <div class="role">${site.role}</div>
</body></html>`;

const ICON = (size: number) => `<!doctype html><html><head><style>${FONTS}
  body { width: ${size}px; height: ${size}px; background: #6B0F1A; color: #F2F0EB;
         display: grid; place-items: center; font-family: Anton; font-size: ${Math.round(size * 0.62)}px; line-height: 1; letter-spacing: -0.02em; }
</style></head><body>RC</body></html>`;

const browser = await chromium.launch();
async function render(html: string, width: number, height: number, out: string) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  // Ré-encodage par sharp : aucune métadonnée conservée
  await sharp(png).png({ compressionLevel: 9 }).toFile(path.join(ROOT, "public", out));
  console.log(`  ✓ public/${out} (${width} × ${height})`);
  await page.close();
}

await render(OG, 1200, 630, "og-image.png");
await render(ICON(180), 180, 180, "apple-touch-icon.png");
await render(ICON(32), 32, 32, "favicon-32.png");
await browser.close();
