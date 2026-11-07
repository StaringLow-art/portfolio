import { z } from "astro/zod";

/** Champ facultatif : vide ("") ou absent = non affiché. */
const facultatif = z.string().trim().default("");

/** Un jeu favori (src/data/jeux.ts). */
export const favoriSchema = z.strictObject({
  titre: z.string().trim().min(1),
  plateforme: facultatif,
  /** Niveau, rang ou grade, tel que tu veux l'afficher. */
  niveau: facultatif,
  texte: facultatif,
  /**
   * Nom d'une image placée dans src/assets/jeux/ (ta propre capture,
   * jamais un logo ni une jaquette officielle). Vide = visuel typographique.
   */
  image: z
    .string()
    .trim()
    .regex(/^$|^[a-z0-9-]+\.(png|jpe?g|webp)$/, "Nom attendu : mon-image.png (dans src/assets/jeux/)")
    .default(""),
  /** Description de l'image pour les personnes aveugles (obligatoire avec une image). */
  imageAlt: facultatif,
});

export const favorisSchema = z
  .array(favoriSchema)
  .min(1)
  .superRefine((liste, ctx) => {
    liste.forEach((jeu, i) => {
      if (jeu.image && !jeu.imageAlt) {
        ctx.addIssue({ code: "custom", path: [i, "imageAlt"], message: `« ${jeu.titre} » : imageAlt est obligatoire avec une image` });
      }
    });
  });

export type Favori = z.output<typeof favoriSchema>;
