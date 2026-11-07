/**
 * Met à jour .steam/steam.json avant la génération du site.
 * Usage : npm run steam:fetch   (clé dans la variable STEAM_API_KEY)
 *
 * Ne bloque jamais la publication :
 *  - clé absente ou Steam en panne → les dernières données valides sont
 *    conservées (ou la section reste masquée s'il n'y en a pas) ;
 *  - profil ou détails de jeux privés → les données sont supprimées et la
 *    section est masquée.
 * La clé n'est jamais affichée : seuls des messages courts sont écrits.
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.ts";
import { STEAM_API, masquer, recupererSteam, vanityDepuisUrl } from "./steam.ts";
import { site } from "../src/config/site.ts";

const FICHIER = process.env.STEAM_DATA_FILE ? path.resolve(process.env.STEAM_DATA_FILE) : path.join(ROOT, ".steam", "steam.json");
const cle = process.env.STEAM_API_KEY?.trim() || undefined;

/** Adresse de l'API : modifiable seulement vers un serveur local (tests). */
function base(): string {
  const autre = process.env.STEAM_API_BASE;
  if (autre && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(autre)) return autre;
  return STEAM_API;
}

/** Avertissement visible dans GitHub Actions (annotation), sinon simple ligne. */
function avertir(message: string): void {
  console.log(process.env.GITHUB_ACTIONS ? `::warning title=Steam::${message}` : `  ! ${message}`);
}

const conserve = () => (existsSync(FICHIER) ? "dernières données valides conservées" : "section Steam masquée (aucune donnée)");

async function main(): Promise<void> {
  if (!site.jeux.steam) {
    console.log("Données Steam : aucun profil configuré dans site.ts.");
    return;
  }
  if (!cle) {
    avertir(`clé STEAM_API_KEY absente, aucune mise à jour (${conserve()}).`);
    return;
  }

  try {
    const resultat = await recupererSteam({ cle, vanity: vanityDepuisUrl(site.jeux.steam), base: base() });
    if (resultat.statut === "prive") {
      rmSync(FICHIER, { force: true });
      // Simple état (aucune donnée) : le cache de GitHub Actions enregistre
      // ainsi que le profil est privé, au lieu de ressortir d'anciennes données.
      mkdirSync(path.dirname(FICHIER), { recursive: true });
      writeFileSync(path.join(path.dirname(FICHIER), "etat.txt"), "profil non public\n");
      avertir(`${resultat.raison} : données supprimées, section Steam masquée.`);
      return;
    }
    rmSync(path.join(path.dirname(FICHIER), "etat.txt"), { force: true });
    // Écriture atomique : un fichier à moitié écrit n'est jamais lu
    mkdirSync(path.dirname(FICHIER), { recursive: true });
    const tmp = `${FICHIER}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(resultat.data, null, 2)}\n`);
    renameSync(tmp, FICHIER);
    const { jeuxPossedes, plusJoues, recents } = resultat.data;
    console.log(`  ✓ Données Steam mises à jour : ${jeuxPossedes} jeux, ${plusJoues.length} joués, ${recents.length} récents.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    avertir(`échec de la récupération (${masquer(message, cle)}) ; ${conserve()}.`);
  }
}

await main();
