// @ts-check
/**
 * Après le build, supprime de dist/_astro/ les images qu'aucune page n'utilise.
 * Raison : Astro copie les images de tous les projets, y compris ceux en
 * brouillon (draft: true). Sans ce nettoyage, ces images seraient en ligne.
 */
import { readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE = /\.(jpe?g|png|webp|avif|gif|svg)$/i;
const REFERRERS = /\.(html|css|js|xml|json|webmanifest)$/i;

/** @param {string} dir */
function files(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full));
    else out.push(full);
  }
  return out;
}

/** @returns {import("astro").AstroIntegration} */
export default function pruneUnusedAssets() {
  return {
    name: "prune-unused-assets",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const all = files(root);
        const corpus = all
          .filter((f) => REFERRERS.test(f))
          .map((f) => readFileSync(f, "utf8"))
          .join("\n");
        const assetsDir = path.join(root, "_astro");
        let removed = 0;
        for (const file of all) {
          if (!file.startsWith(assetsDir) || !IMAGE.test(file)) continue;
          if (!corpus.includes(path.basename(file))) {
            rmSync(file);
            removed++;
          }
        }
        logger.info(`${removed} image(s) inutilisée(s) supprimée(s) de dist/_astro/`);
      },
    },
  };
}
