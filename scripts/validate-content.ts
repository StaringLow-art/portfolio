/**
 * Validation du contenu, en complément de `astro check`
 * (qui valide déjà le schéma des projets) :
 *  - schéma de src/config/site.ts et du parcours ;
 *  - aucune vidéo ni iframe dans les projets ;
 *  - documents PDF existants ;
 *  - numéros « order » uniques ;
 *  - disponibilité écrite uniquement dans site.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROOT, Report, walk } from "./lib.ts";
import { site } from "../src/config/site.ts";
import { siteSchema } from "../src/schemas/site.ts";

const report = new Report("Validation du contenu");

// 1. site.ts
const siteResult = siteSchema.safeParse(site);
if (siteResult.success) report.ok("src/config/site.ts respecte son schéma");
else for (const issue of siteResult.error.issues) report.fail(`site.ts › ${issue.path.join(".")} : ${issue.message}`);

// 2. Parcours (le schéma est appliqué à l'import)
try {
  await import("../src/data/parcours.ts");
  report.ok("src/data/parcours.ts respecte son schéma");
} catch (error) {
  report.fail(`parcours.ts invalide : ${error instanceof Error ? error.message : String(error)}`);
}

// 2b. Jeux favoris (schéma appliqué à l'import) et images existantes
try {
  const { favoris } = await import("../src/data/jeux.ts");
  for (const jeu of favoris) {
    if (jeu.image && !existsSync(path.join(ROOT, "src/assets/jeux", jeu.image))) {
      report.fail(`jeux.ts › « ${jeu.titre} » : image introuvable « src/assets/jeux/${jeu.image} ».`);
    }
  }
  report.ok(`src/data/jeux.ts respecte son schéma (${favoris.length} favoris)`);
} catch (error) {
  report.fail(`jeux.ts invalide : ${error instanceof Error ? error.message : String(error)}`);
}

// 3. Projets
const PROJETS_DIR = path.join(ROOT, "src/content/projets");
const FORBIDDEN = /<iframe|<video|<embed|<object|youtube\.com|youtu\.be|vimeo\.com|dailymotion|tiktok\.com|\.(mp4|webm|mov|m4v|avi|mkv)\b/i;
const orders = new Map<number, string>();

for (const file of walk(PROJETS_DIR).filter((f) => f.endsWith(".md"))) {
  const raw = readFileSync(path.join(PROJETS_DIR, file), "utf8");
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";

  if (FORBIDDEN.test(raw)) report.fail(`${file} : vidéo, iframe ou lien vidéo interdit.`);

  for (const match of frontmatter.matchAll(/file:\s*["']?([^"'\s]+)["']?/g)) {
    const doc = match[1]!;
    if (!existsSync(path.join(ROOT, "public", doc))) report.fail(`${file} : document introuvable « public${doc} ».`);
  }

  const draft = /^draft:\s*true\s*$/m.test(frontmatter);
  const order = Number(frontmatter.match(/^order:\s*(\d+)\s*$/m)?.[1]);
  if (!draft && Number.isFinite(order)) {
    const other = orders.get(order);
    if (other) report.fail(`${file} et ${other} : même « order » (${order}).`);
    orders.set(order, file);
  }
}
report.ok("projets vérifiés (vidéos, documents, ordre)");

// 4. La disponibilité n'est écrite que dans site.ts
const needle = "février 2027";
for (const file of walk(path.join(ROOT, "src"))) {
  if (file === "config/site.ts" || !/\.(astro|ts|md|css|js)$/.test(file)) continue;
  if (readFileSync(path.join(ROOT, "src", file), "utf8").includes(needle)) {
    report.fail(`src/${file} : la disponibilité doit être lue depuis site.ts, pas recopiée.`);
  }
}
report.ok("disponibilité centralisée dans site.ts");

report.finish();
