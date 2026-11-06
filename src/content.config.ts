import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const texte = z.string().trim().min(1);

/** Projets : un fichier Markdown par projet dans src/content/projets/. */
const projets = defineCollection({
  loader: glob({ base: "./src/content/projets", pattern: "*.md" }),
  schema: ({ image }) =>
    z.strictObject({
      title: texte,
      summary: texte,
      /** Position dans la mosaïque (1 = premier). Doit être unique. */
      order: z.number().int().positive(),
      role: texte,
      technologies: z.array(texte).min(1),
      cover: image(),
      coverAlt: texte,
      /** Partie de l'image gardée dans la vignette de la mosaïque (CSS object-position). */
      coverPosition: z
        .string()
        .regex(/^\d{1,3}% \d{1,3}%$/, "Format attendu : « 50% 0% » (horizontal vertical)")
        .default("50% 50%"),
      /** Lien « Voir l'image en taille réelle » sous l'image (captures d'écran). */
      coverZoom: z.boolean().default(false),
      /** true = projet masqué partout (pages, sitemap, compteur). */
      draft: z.boolean(),
      /** Images facultatives affichées dans la page du projet. */
      images: z
        .array(
          z.strictObject({
            src: image(),
            alt: texte,
            caption: texte.optional(),
          }),
        )
        .default([]),
      /** Documents PDF facultatifs, placés dans public/documents/<projet>/. */
      documents: z
        .array(
          z.strictObject({
            title: texte,
            file: z
              .string()
              .regex(
                /^\/documents\/[a-z0-9-]+\/[a-z0-9-]+\.pdf$/,
                "Chemin attendu : /documents/<projet>/<nom-du-fichier>.pdf",
              ),
          }),
        )
        .default([]),
    }),
});

export const collections = { projets };
