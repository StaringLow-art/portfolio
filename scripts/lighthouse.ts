/**
 * Lighthouse sur le build de production (dist/), profil mobile par défaut.
 * Usage : npm run build && npm run lighthouse
 *
 * - Démarre `astro preview`, mesure l'accueil et une page de projet.
 * - 3 mesures par page ; la médiane de chaque catégorie est retenue.
 * - Objectifs : Performance ≥ 90, Accessibilité ≥ 95,
 *   Bonnes pratiques ≥ 95, SEO ≥ 95. Échec (code 1) sinon.
 * - Rapports HTML dans lighthouse/ (dossier ignoré par Git).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import { DIST, ROOT } from "./lib.ts";

const PORT = 4321;
const DEBUG_PORT = 9333;
const RUNS = 3;
const PAGES = ["/", "/pro/", "/jeux/", "/projets/homelab/", "/projets/projet-cfc/"];
const TARGETS: Record<string, number> = {
  performance: 90,
  accessibility: 95,
  "best-practices": 95,
  seo: 95,
};
const OUT = path.join(ROOT, "lighthouse");

if (!existsSync(DIST)) {
  console.error("dist/ absent : lancer d'abord « npm run build ».");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// Serveur de prévisualisation (sans dépendre d'un shell particulier)
// Astro n'autorise qu'un serveur de prévisualisation par projet :
// on réutilise celui qui tourne déjà (port 4321), sinon on le démarre.
const base = `http://localhost:${PORT}`;
const isUp = async () => {
  try {
    return (await fetch(base)).ok;
  } catch {
    return false;
  }
};
let server: ReturnType<typeof spawn> | null = null;
if (!(await isUp())) {
  server = spawn(process.execPath, [path.join(ROOT, "node_modules/astro/bin/astro.mjs"), "preview", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
  });
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    ready = await isUp();
    if (!ready) await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    server.kill();
    console.error(`Le serveur de prévisualisation n'a pas démarré sur ${base}.`);
    process.exit(1);
  }
}

const browser = await chromium.launch({ channel: "chromium", args: [`--remote-debugging-port=${DEBUG_PORT}`] });
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
let failed = false;

try {
  for (const pagePath of PAGES) {
    const scores: Record<string, number[]> = {};
    let medianReport = "";
    const perfRuns: { score: number; report: string }[] = [];
    for (let run = 0; run < RUNS; run++) {
      const result = await lighthouse(`${base}${pagePath}`, {
        port: DEBUG_PORT,
        output: "html",
        logLevel: "error",
        onlyCategories: Object.keys(TARGETS),
      });
      if (!result) throw new Error("Lighthouse n'a renvoyé aucun résultat");
      for (const [key, category] of Object.entries(result.lhr.categories)) {
        (scores[key] ??= []).push(Math.round((category.score ?? 0) * 100));
      }
      perfRuns.push({ score: scores.performance!.at(-1)!, report: String(result.report) });
      if (result.lhr.runtimeError) console.warn(`  ! ${result.lhr.runtimeError.message}`);
    }
    medianReport = perfRuns.sort((a, b) => a.score - b.score)[Math.floor(RUNS / 2)]!.report;
    const name = pagePath === "/" ? "accueil" : pagePath.replaceAll("/", "-").replace(/^-|-$/g, "");
    writeFileSync(path.join(OUT, `${name}.html`), medianReport);

    console.log(`\n${pagePath} (mobile, médiane de ${RUNS} mesures)`);
    for (const [key, target] of Object.entries(TARGETS)) {
      const value = median(scores[key] ?? [0]);
      const ok = value >= target;
      if (!ok) failed = true;
      console.log(`  ${ok ? "✓" : "✗"} ${key.padEnd(15)} ${String(value).padStart(3)}  (objectif ≥ ${target} ; mesures : ${scores[key]?.join(", ")})`);
    }
  }
} finally {
  await browser.close();
  server?.kill();
}

console.log(`\nRapports : ${OUT}`);
if (failed) {
  console.error("Lighthouse : objectif non atteint.");
  process.exit(1);
}
console.log("Lighthouse : tous les objectifs sont atteints.");
