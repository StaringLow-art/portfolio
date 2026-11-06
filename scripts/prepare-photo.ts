/**
 * Prépare le portrait du héros, entièrement en local (aucun envoi externe).
 * Usage : npm run prepare:photo -- <original.png> [--flip]
 *
 * Étapes :
 *  1. retournement horizontal seulement avec --flip (par défaut : sens d'origine) ;
 *  2. recadrage sur la personne (marges transparentes retirées) ;
 *  3. nettoyage des bords : les pixels semi-transparents du contour reprennent
 *     la couleur de l'intérieur voisin (supprime le halo de l'ancien fond,
 *     notamment autour des cheveux), et le voile presque transparent est effacé ;
 *  4. noir et blanc légèrement contrasté + grain, seulement sur la personne ;
 *  5. export PNG avec transparence, SANS métadonnées.
 *
 * Résultat : src/assets/photo/ryan-cardamone.png
 */
import path from "node:path";
import sharp from "sharp";
import { ROOT } from "./lib.ts";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
if (!input) {
  console.error("Usage : npm run prepare:photo -- <chemin/vers/original.png> [--flip]");
  process.exit(1);
}
const flip = args.includes("--flip");
const OUT = path.join(ROOT, "src/assets/photo/ryan-cardamone.png");

// 1. Lecture RGBA, retournement
let pipeline = sharp(path.resolve(input)).ensureAlpha();
if (flip) pipeline = pipeline.flop();
const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x: number, y: number) => (y * W + x) * 4;

// 2. Boîte englobante de la personne (alpha > 8)
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[px(x, y) + 3]! > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

// 3a. Décontamination des couleurs du contour : propagation de la couleur
//     des pixels opaques vers les pixels semi-transparents (8 passes).
const SOLID = 235;
const assigned = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (data[i * 4 + 3]! >= SOLID) assigned[i] = 1;
for (let pass = 0; pass < 8; pass++) {
  const next: Array<[number, number, number, number]> = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (assigned[i] || data[i * 4 + 3] === 0) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = (y + dy) * W + (x + dx);
          if (assigned[j]) {
            r += data[j * 4]!;
            g += data[j * 4 + 1]!;
            b += data[j * 4 + 2]!;
            n++;
          }
        }
      }
      if (n > 0) next.push([i, r / n, g / n, b / n]);
    }
  }
  for (const [i, r, g, b] of next) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    assigned[i] = 1;
  }
}

// 3b. Contour resserré : le voile presque transparent disparaît,
//     les mèches fines restent (courbe douce sur l'alpha).
const LOW = 28;
for (let i = 0; i < W * H; i++) {
  const a = data[i * 4 + 3]!;
  data[i * 4 + 3] = a <= LOW ? 0 : Math.min(255, Math.round(((a - LOW) / (255 - LOW)) ** 0.9 * 255));
}

// 4. Noir et blanc + contraste léger + grain (uniquement là où il y a la personne)
let seed = 1337;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};
for (let i = 0; i < W * H; i++) {
  const o = i * 4;
  const a = data[o + 3]!;
  if (a === 0) {
    data[o] = data[o + 1] = data[o + 2] = 0;
    continue;
  }
  const lum = 0.2126 * data[o]! + 0.7152 * data[o + 1]! + 0.0722 * data[o + 2]!;
  const contrasted = (lum - 128) * 1.08 + 128;
  const grain = (rand() - 0.5) * 22;
  const v = Math.max(0, Math.min(255, Math.round(contrasted + grain)));
  data[o] = data[o + 1] = data[o + 2] = v;
}

// 5. Recadrage avec une petite marge, export sans métadonnées
const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
const left = Math.max(0, minX - pad);
const top = Math.max(0, minY - pad);
const right = Math.min(W - 1, maxX + pad);
// Le bas de la photo (coupe du buste) reste collé au bord inférieur
const bottom = maxY >= H - 3 ? H - 1 : Math.min(H - 1, maxY + pad);
await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`  ✓ ${path.relative(ROOT, OUT)} : ${meta.width} × ${meta.height}, transparence ${meta.hasAlpha ? "oui" : "non"}, EXIF ${meta.exif ? "présent" : "aucun"}, XMP ${meta.xmp ? "présent" : "aucun"}`);
console.log(`    retournée : ${flip ? "oui" : "non"} ; recadrage ${left},${top} → ${right},${bottom} (original ${W} × ${H})`);
