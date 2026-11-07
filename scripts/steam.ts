/**
 * Récupération des données Steam (pendant la génération du site uniquement).
 * Documentation : https://partner.steamgames.com/doc/webapi_overview
 *
 * - La clé est envoyée dans l'en-tête « x-webapi-key » (documenté par Steam),
 *   jamais dans l'adresse : elle ne peut donc pas apparaître dans un message
 *   d'erreur contenant l'URL.
 * - Chaque réponse est validée ; seuls les champs utiles sont lus. Les autres
 *   (pseudo, avatar, statut en ligne, jeu en cours, pays…) sont ignorés et
 *   jamais enregistrés.
 */
import { z } from "astro/zod";
import { steamDataSchema, type SteamData } from "../src/schemas/steam.ts";

export const STEAM_API = "https://api.steampowered.com";

/** « https://steamcommunity.com/id/W1mdra_/ » → « W1mdra_ » */
export function vanityDepuisUrl(url: string): string {
  const m = url.match(/^https:\/\/steamcommunity\.com\/id\/([A-Za-z0-9_-]+)\/?$/);
  if (!m) throw new Error("adresse de profil Steam invalide");
  return m[1]!;
}

/** Remplace la clé par « *** » dans un texte (messages d'erreur). */
export function masquer(texte: string, cle: string | undefined): string {
  return cle ? texte.split(cle).join("***") : texte;
}

// ---------------------------------------------------------------------------
// Réponses de l'API (seuls les champs lus sont déclarés ; le reste est ignoré)
// ---------------------------------------------------------------------------
const vanitySchema = z.object({
  response: z.object({ success: z.number(), steamid: z.string().regex(/^\d{17}$/).optional() }),
});

const resumeSchema = z.object({
  response: z.object({ players: z.array(z.object({ communityvisibilitystate: z.number() })) }),
});

const jeuSchema = z.object({
  name: z.string().optional(),
  playtime_forever: z.number().int().nonnegative().default(0),
  playtime_2weeks: z.number().int().nonnegative().optional(),
});

const possedesSchema = z.object({
  response: z.object({ game_count: z.number().int().nonnegative().optional(), games: z.array(jeuSchema).optional() }),
});

const recentsSchema = z.object({
  response: z.object({ games: z.array(jeuSchema).optional() }),
});

export type ReponsePossedes = z.input<typeof possedesSchema>;
export type ReponseRecents = z.input<typeof recentsSchema>;

/** Résultat : données publiques, profil privé, ou erreur (exception). */
export type Resultat = { statut: "public"; data: SteamData } | { statut: "prive"; raison: string };

/**
 * Transforme les réponses brutes en données à publier.
 * Retourne null si les détails de jeux ne sont pas visibles.
 */
export function normaliser(possedes: unknown, recents: unknown, maintenant: Date): SteamData | null {
  const p = possedesSchema.parse(possedes).response;
  if (!p.games || p.game_count === undefined) return null; // détails de jeux privés
  const r = recentsSchema.parse(recents).response.games ?? [];

  const plusJoues = p.games
    .filter((g): g is typeof g & { name: string } => typeof g.name === "string" && g.name.trim() !== "" && g.playtime_forever > 0)
    .map((g) => ({ nom: g.name.trim(), minutes: g.playtime_forever }))
    .sort((a, b) => b.minutes - a.minutes || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, 100);

  const recentsNets = r
    .filter((g): g is typeof g & { name: string } => typeof g.name === "string" && g.name.trim() !== "")
    .map((g) => ({ nom: g.name.trim(), minutes2Semaines: g.playtime_2weeks ?? 0, minutesTotal: g.playtime_forever }))
    .sort((a, b) => b.minutes2Semaines - a.minutes2Semaines)
    .slice(0, 50);

  return steamDataSchema.parse({
    version: 1,
    misAJour: maintenant.toISOString(),
    jeuxPossedes: p.game_count,
    minutesTotal: p.games.reduce((s, g) => s + g.playtime_forever, 0),
    plusJoues,
    recents: recentsNets,
  });
}

type Options = {
  cle: string;
  vanity: string;
  base?: string;
  maintenant?: Date;
  /** Délai maximal par requête (ms). */
  delai?: number;
};

/** Interroge l'API Steam. Lève une erreur (sans la clé) en cas d'échec. */
export async function recupererSteam({ cle, vanity, base = STEAM_API, maintenant = new Date(), delai = 15_000 }: Options): Promise<Resultat> {
  const appel = async (chemin: string, schema: z.ZodType) => {
    const res = await fetch(`${base}${chemin}`, {
      headers: { "x-webapi-key": cle, accept: "application/json" },
      signal: AbortSignal.timeout(delai),
    });
    if (!res.ok) throw new Error(`Steam a répondu ${res.status} (${chemin.split("?")[0]})`);
    const json: unknown = await res.json().catch(() => {
      throw new Error(`réponse illisible (${chemin.split("?")[0]})`);
    });
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new Error(`réponse inattendue (${chemin.split("?")[0]})`);
    return parsed.data;
  };

  const v = (await appel(`/ISteamUser/ResolveVanityURL/v1/?vanityurl=${encodeURIComponent(vanity)}`, vanitySchema)) as z.output<typeof vanitySchema>;
  if (v.response.success !== 1 || !v.response.steamid) throw new Error("profil Steam introuvable");
  const steamid = v.response.steamid;

  const s = (await appel(`/ISteamUser/GetPlayerSummaries/v2/?steamids=${steamid}`, resumeSchema)) as z.output<typeof resumeSchema>;
  // 3 = profil public (les autres valeurs : privé ou amis seulement)
  if (s.response.players[0]?.communityvisibilitystate !== 3) return { statut: "prive", raison: "profil Steam non public" };

  // Interface « Service » : paramètres en JSON (input_json). Le SteamID est
  // écrit tel quel : en nombre JavaScript, ses 17 chiffres seraient arrondis.
  const input = (extra: string) => encodeURIComponent(`{"steamid":${steamid}${extra}}`);
  const possedes = await appel(
    `/IPlayerService/GetOwnedGames/v1/?input_json=${input(',"include_appinfo":true,"include_played_free_games":true')}`,
    possedesSchema,
  );
  const recents = await appel(`/IPlayerService/GetRecentlyPlayedGames/v1/?input_json=${input("")}`, recentsSchema);

  const data = normaliser(possedes, recents, maintenant);
  if (!data) return { statut: "prive", raison: "détails de jeux non publics" };
  return { statut: "public", data };
}
