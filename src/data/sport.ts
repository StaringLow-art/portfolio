/**
 * Univers Sport (karting) : calendrier des prochaines courses.
 * Le texte « Pourquoi le karting » est dans src/content/sport/introduction.md,
 * et chaque course passée a sa page dans src/content/sport/courses/.
 */
import { calendrierSchema } from "../schemas/sport.ts";

/**
 * Prochaines courses. Une date passée disparaît toute seule du site
 * (le site est régénéré chaque jour). Exemple :
 *   { date: "2026-12-05", circuit: "Nom du circuit", evenement: "Nom de l'événement" },
 * Liste vide (ou seulement des dates passées) = « Aucune course prévue pour le moment ».
 */
export const calendrier = calendrierSchema.parse([]);
