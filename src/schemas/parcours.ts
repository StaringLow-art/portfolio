import { z } from "astro/zod";

const texte = z.string().trim().min(1);

/** Schéma du parcours (src/data/parcours.ts). */
export const parcoursSchema = z.strictObject({
  /** Paragraphe d'introduction en tête de page. */
  introduction: texte,
  /** Postes ou domaines recherchés (une ligne). */
  recherche: texte,
  etapes: z
    .array(
      z.strictObject({
        type: z.enum(["formation", "experience"]),
        /** Période telle que Ryan la fournit, par exemple « Août 2022 – juin 2026 ». */
        periode: texte,
        titre: texte,
        /** Établissement ou entreprise. */
        organisation: texte,
        description: texte.optional(),
        /** Liste de tâches ou de réalisations (facultative). */
        taches: z.array(texte).min(1).optional(),
      }),
    )
    .min(1),
  competences: z
    .array(
      z.strictObject({
        groupe: texte,
        elements: z.array(texte).min(1),
      }),
    )
    .min(1),
});

export type Parcours = z.output<typeof parcoursSchema>;
