import { z } from "astro/zod";

/**
 * Données Steam conservées entre deux générations du site (.steam/steam.json).
 * Uniquement des noms de jeux et des durées : jamais d'identifiant, de pseudo,
 * d'avatar, de statut en ligne, de jeu en cours ni de pays.
 */
const nom = z.string().trim().min(1).max(200);
const minutes = z.number().int().nonnegative();

export const steamDataSchema = z.strictObject({
  version: z.literal(1),
  /** Date de la dernière récupération réussie (ISO 8601). */
  misAJour: z.iso.datetime(),
  jeuxPossedes: z.number().int().nonnegative(),
  minutesTotal: minutes,
  /** Jeux joués, du plus joué au moins joué (100 au plus). */
  plusJoues: z.array(z.strictObject({ nom, minutes })).max(100),
  /** Jeux des deux dernières semaines. */
  recents: z.array(z.strictObject({ nom, minutes2Semaines: minutes, minutesTotal: minutes })).max(50),
});

export type SteamData = z.output<typeof steamDataSchema>;
