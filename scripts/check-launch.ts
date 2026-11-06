/**
 * Contrôle avant mise en ligne : échoue tant que le contenu réel manque.
 *  - vraie photo : src/assets/photo/ryan-cardamone.(jpg|jpeg|png|webp|avif)
 *  - vrai CV : fichier indiqué par site.cvPath, sans marqueur temporaire
 *  - parcours complété
 *  - projets Homelab et CFC présents et publiés
 *  - aucun « À_COMPLÉTER » ni visuel temporaire dans le contenu publié
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { DIST, ROOT, Report, walk } from "./lib.ts";
import { site } from "../src/config/site.ts";

const report = new Report("Contrôle de mise en ligne");
const TODO = "À_COMPLÉTER";
/** Marqueur présent dans les fichiers temporaires (CV provisoire, etc.). */
const TEMP_MARKER = "FICHIER_TEMPORAIRE";
const TEMP_ASSET = /-temporaire\./i;

// 1. Photo
const photoDir = path.join(ROOT, "src/assets/photo");
const photos = existsSync(photoDir)
  ? readdirSync(photoDir).filter((f) => /^ryan-cardamone\.(jpe?g|png|webp|avif)$/i.test(f))
  : [];
if (photos.length === 0) report.fail("photo réelle manquante : src/assets/photo/ryan-cardamone.(jpg|png|webp|avif)");
else report.ok(`photo : ${photos[0]}`);

// 2. CV
const cvFile = path.join(ROOT, "public", site.cvPath);
if (!existsSync(cvFile)) {
  report.fail(`CV manquant : public${site.cvPath}`);
} else {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(cvFile)));
  const { text } = await extractText(pdf, { mergePages: true });
  if (text.includes(TEMP_MARKER)) report.fail("le CV est encore le fichier temporaire");
  else report.ok("CV présent");
}

// 3. Parcours
const parcoursSource = readFileSync(path.join(ROOT, "src/data/parcours.ts"), "utf8");
if (parcoursSource.includes(TODO)) report.fail(`parcours : il reste des « ${TODO} » dans src/data/parcours.ts`);
else report.ok("parcours complété");

// 4. Projets obligatoires
const PROJETS_DIR = path.join(ROOT, "src/content/projets");
for (const [file, label] of [["homelab.md", "Homelab"], ["projet-cfc.md", "de CFC"]] as const) {
  const full = path.join(PROJETS_DIR, file);
  if (!existsSync(full)) report.fail(`projet ${label} manquant (${file})`);
  else if (!/^draft:\s*false\s*$/m.test(readFileSync(full, "utf8"))) report.fail(`projet ${label} non publié (draft)`);
  else report.ok(`projet ${label} publié`);
}

// 5. Contenu publié : aucun À_COMPLÉTER ni visuel temporaire
for (const file of walk(PROJETS_DIR).filter((f) => f.endsWith(".md"))) {
  const raw = readFileSync(path.join(PROJETS_DIR, file), "utf8");
  if (/^draft:\s*true\s*$/m.test(raw)) continue; // non publié
  if (raw.includes(TODO)) report.fail(`projets/${file} : il reste des « ${TODO} »`);
  if (TEMP_ASSET.test(raw)) report.fail(`projets/${file} : utilise encore un visuel temporaire`);
}
for (const dir of ["src/pages", "src/components", "src/layouts", "src/config"]) {
  for (const file of walk(path.join(ROOT, dir))) {
    const raw = readFileSync(path.join(ROOT, dir, file), "utf8");
    if (raw.includes(TODO)) report.fail(`${dir}/${file} : il reste des « ${TODO} »`);
  }
}

// 6. Site généré (si présent)
if (existsSync(DIST)) {
  for (const file of walk(DIST, new Set()).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(path.join(DIST, file), "utf8");
    if (html.includes(TODO)) report.fail(`dist/${file} : contient « ${TODO} »`);
    if (/-temporaire\.[\w-]*\.?(?:jpe?g|png|webp|avif)/i.test(html)) report.fail(`dist/${file} : affiche un visuel temporaire`);
  }
  report.ok("site généré analysé");
} else {
  report.warn("dist/ absent : le site généré n'a pas été analysé (lancer « npm run build »)");
}

report.finish();
