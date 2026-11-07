/**
 * Récupération Steam, testée sans Internet ni vraie clé : un faux serveur
 * Steam local répond comme l'API (avec des champs privés en plus, qui ne
 * doivent jamais être enregistrés).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { masquer, normaliser, recupererSteam, vanityDepuisUrl } from "../scripts/steam.ts";

// Fausse clé (jamais une vraie) : volontairement hors du format des clés Steam
const CLE = "cle-de-test-ne-pas-utiliser";
const STEAMID = "76561190000000042";

// Valeurs privées que l'API renvoie et qui ne doivent JAMAIS être enregistrées
const PRIVE = { pseudo: "PseudoSecret", enCours: "JeuEnCoursSecret", pays: "ZZ", avatar: "avatar-secret.jpg" };

const POSSEDES = {
  response: {
    game_count: 3,
    games: [
      { appid: 1, name: "Jeu A", playtime_forever: 600, img_icon_url: "icone", rtime_last_played: 1700000000 },
      { appid: 2, name: "Jeu B", playtime_forever: 1500, playtime_windows_forever: 1500 },
      { appid: 3, name: "Jeu jamais lancé", playtime_forever: 0 },
    ],
  },
};
const RECENTS = { response: { total_count: 1, games: [{ appid: 2, name: "Jeu B", playtime_2weeks: 90, playtime_forever: 1500 }] } };

type Mode = "public" | "prive" | "panne" | "details-prives";

/** Faux serveur Steam. Enregistre les requêtes reçues. */
async function fauxSteam(mode: Mode) {
  const requetes: { url: string; cle: string | undefined }[] = [];
  const server: Server = createServer((req: IncomingMessage, res) => {
    requetes.push({ url: req.url ?? "", cle: req.headers["x-webapi-key"] as string | undefined });
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers["x-webapi-key"] !== CLE) return json(403, {});
    if (mode === "panne") return json(500, { erreur: true });
    const url = req.url ?? "";
    if (url.startsWith("/ISteamUser/ResolveVanityURL/v1/")) return json(200, { response: { success: 1, steamid: STEAMID } });
    if (url.startsWith("/ISteamUser/GetPlayerSummaries/v2/")) {
      return json(200, {
        response: {
          players: [
            {
              steamid: STEAMID,
              communityvisibilitystate: mode === "prive" ? 1 : 3,
              personaname: PRIVE.pseudo,
              personastate: 1,
              gameextrainfo: PRIVE.enCours,
              loccountrycode: PRIVE.pays,
              avatarfull: PRIVE.avatar,
            },
          ],
        },
      });
    }
    if (url.startsWith("/IPlayerService/GetOwnedGames/v1/")) return json(200, mode === "details-prives" ? { response: {} } : POSSEDES);
    if (url.startsWith("/IPlayerService/GetRecentlyPlayedGames/v1/")) return json(200, RECENTS);
    return json(404, {});
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, requetes, fermer: () => new Promise<void>((ok) => server.close(() => ok())) };
}

/**
 * Lance le script (npm run steam:fetch) dans un dossier de données temporaire.
 * Asynchrone : le faux serveur tourne dans ce même processus et doit pouvoir
 * répondre pendant que le script attend.
 */
async function lancerScript(env: Record<string, string>, contenuInitial?: string) {
  const dossier = mkdtempSync(path.join(tmpdir(), "steam-test-"));
  const fichier = path.join(dossier, "steam.json");
  if (contenuInitial !== undefined) writeFileSync(fichier, contenuInitial);
  const { STEAM_API_KEY: _ignoree, GITHUB_ACTIONS: _gh, ...parent } = process.env;
  const enfant = spawn(process.execPath, ["scripts/fetch-steam.ts"], {
    cwd: process.cwd(),
    env: { ...parent, STEAM_DATA_FILE: fichier, ...env },
  });
  let sortie = "";
  enfant.stdout.on("data", (d) => (sortie += String(d)));
  enfant.stderr.on("data", (d) => (sortie += String(d)));
  const code = await new Promise<number | null>((ok) => enfant.on("close", ok));
  const lire = () => (existsSync(fichier) ? readFileSync(fichier, "utf8") : null);
  return { code, sortie, lire, nettoyer: () => rmSync(dossier, { recursive: true, force: true }) };
}

const DONNEES_VALIDES = `${JSON.stringify({
  version: 1,
  misAJour: "2026-11-01T06:00:00.000Z",
  jeuxPossedes: 5,
  minutesTotal: 120,
  plusJoues: [{ nom: "Ancien jeu", minutes: 120 }],
  recents: [],
})}\n`;

test.describe("Steam : transformation des réponses", () => {
  test("ne garde que les noms et les durées, triés ; jeux jamais lancés exclus", () => {
    const data = normaliser(POSSEDES, RECENTS, new Date("2026-11-06T06:00:00Z"))!;
    expect(data).toEqual({
      version: 1,
      misAJour: "2026-11-06T06:00:00.000Z",
      jeuxPossedes: 3,
      minutesTotal: 2100,
      plusJoues: [
        { nom: "Jeu B", minutes: 1500 },
        { nom: "Jeu A", minutes: 600 },
      ],
      recents: [{ nom: "Jeu B", minutes2Semaines: 90, minutesTotal: 1500 }],
    });
    const texte = JSON.stringify(data);
    for (const champ of ["appid", "img_icon_url", "rtime_last_played", "playtime_windows_forever"]) expect(texte).not.toContain(champ);
  });

  test("détails de jeux privés : aucune donnée", () => {
    expect(normaliser({ response: {} }, RECENTS, new Date())).toBeNull();
  });

  test("outils : adresse du profil, masquage de la clé", () => {
    expect(vanityDepuisUrl("https://steamcommunity.com/id/W1mdra_/")).toBe("W1mdra_");
    expect(() => vanityDepuisUrl("https://exemple.com/W1mdra_")).toThrow();
    expect(masquer(`échec avec ${CLE} dedans`, CLE)).toBe("échec avec *** dedans");
  });
});

test.describe("Steam : appels à l'API (faux serveur local)", () => {
  test("profil public : clé dans l'en-tête seulement, SteamID exact, données sans champ privé", async () => {
    const steam = await fauxSteam("public");
    try {
      const r = await recupererSteam({ cle: CLE, vanity: "W1mdra_", base: steam.base, maintenant: new Date("2026-11-06T06:00:00Z") });
      expect(r.statut).toBe("public");
      expect(steam.requetes).toHaveLength(4);
      for (const req of steam.requetes) {
        expect(req.cle).toBe(CLE);
        expect(req.url).not.toContain(CLE);
      }
      // Le SteamID à 17 chiffres n'est pas arrondi (il dépasse la précision d'un nombre JavaScript)
      const owned = decodeURIComponent(steam.requetes.find((q) => q.url.includes("GetOwnedGames"))!.url);
      expect(owned).toContain(`"steamid":${STEAMID}`);
      const texte = JSON.stringify(r);
      for (const valeur of Object.values(PRIVE)) expect(texte).not.toContain(valeur);
      expect(texte).not.toContain(STEAMID);
    } finally {
      await steam.fermer();
    }
  });

  test("profil privé : statut « privé », aucune donnée", async () => {
    const steam = await fauxSteam("prive");
    try {
      const r = await recupererSteam({ cle: CLE, vanity: "W1mdra_", base: steam.base });
      expect(r).toEqual({ statut: "prive", raison: "profil Steam non public" });
      // Les jeux ne sont même pas demandés
      expect(steam.requetes.some((q) => q.url.includes("IPlayerService"))).toBe(false);
    } finally {
      await steam.fermer();
    }
  });

  test("panne de Steam : erreur sans la clé", async () => {
    const steam = await fauxSteam("panne");
    try {
      const erreur = await recupererSteam({ cle: CLE, vanity: "W1mdra_", base: steam.base }).catch((e: Error) => e);
      expect(erreur).toBeInstanceOf(Error);
      expect((erreur as Error).message).toContain("500");
      expect((erreur as Error).message).not.toContain(CLE);
    } finally {
      await steam.fermer();
    }
  });
});

test.describe("Steam : script de génération (le site reste publiable)", () => {
  test("clé absente : dernières données conservées, rien d'autre", async () => {
    const r = await lancerScript({}, DONNEES_VALIDES);
    try {
      expect(r.code).toBe(0);
      expect(r.sortie).toContain("clé STEAM_API_KEY absente");
      expect(r.lire()).toBe(DONNEES_VALIDES);
    } finally {
      r.nettoyer();
    }
  });

  test("clé absente et aucune donnée : section masquée, aucune donnée inventée", async () => {
    const r = await lancerScript({});
    try {
      expect(r.code).toBe(0);
      expect(r.sortie).toContain("section Steam masquée");
      expect(r.lire()).toBeNull();
    } finally {
      r.nettoyer();
    }
  });

  test("Steam en panne : dernières données conservées, clé jamais affichée", async () => {
    const steam = await fauxSteam("panne");
    const r = await lancerScript({ STEAM_API_KEY: CLE, STEAM_API_BASE: steam.base }, DONNEES_VALIDES);
    try {
      expect(r.code).toBe(0);
      expect(r.sortie).toContain("dernières données valides conservées");
      expect(r.sortie).not.toContain(CLE);
      expect(r.lire()).toBe(DONNEES_VALIDES);
    } finally {
      r.nettoyer();
      await steam.fermer();
    }
  });

  test("profil devenu privé : données supprimées", async () => {
    const steam = await fauxSteam("prive");
    const r = await lancerScript({ STEAM_API_KEY: CLE, STEAM_API_BASE: steam.base }, DONNEES_VALIDES);
    try {
      expect(r.code).toBe(0);
      expect(r.lire()).toBeNull();
    } finally {
      r.nettoyer();
      await steam.fermer();
    }
  });

  test("profil public : données écrites, valides, sans champ privé ni clé", async () => {
    const steam = await fauxSteam("public");
    const r = await lancerScript({ STEAM_API_KEY: CLE, STEAM_API_BASE: steam.base });
    try {
      expect(r.code).toBe(0);
      expect(r.sortie).not.toContain(CLE);
      const contenu = r.lire()!;
      expect(JSON.parse(contenu)).toMatchObject({ version: 1, jeuxPossedes: 3 });
      for (const interdit of [CLE, STEAMID, ...Object.values(PRIVE)]) expect(contenu).not.toContain(interdit);
    } finally {
      r.nettoyer();
      await steam.fermer();
    }
  });
});
