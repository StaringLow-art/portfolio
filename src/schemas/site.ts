import { z } from "astro/zod";

/** Schéma de src/config/site.ts, vérifié par `npm run check`. */
export const siteSchema = z.strictObject({
  name: z.string().min(1),
  presentation: z.string().min(1),
  role: z.string().min(1),
  location: z.string().min(1),
  availability: z.string().min(1),
  email: z.email(),
  cvPath: z.string().regex(/^\/[A-Za-z0-9._-]+\.pdf$/, "Chemin attendu : /Nom-du-fichier.pdf"),
  links: z.strictObject({
    github: z
      .string()
      .regex(/^https:\/\/github\.com\/[A-Za-z0-9-]+\/?$/, "Lien GitHub attendu : https://github.com/utilisateur")
      .nullable(),
    linkedin: z
      .string()
      .regex(
        /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/,
        "Lien LinkedIn attendu : https://www.linkedin.com/in/profil",
      )
      .nullable(),
  }),
  jeux: z.strictObject({
    steam: z
      .string()
      .regex(/^https:\/\/steamcommunity\.com\/id\/[A-Za-z0-9_-]+\/$/, "Lien Steam attendu : https://steamcommunity.com/id/profil/")
      .nullable(),
    medal: z
      .string()
      .regex(/^https:\/\/medal\.tv\/u\/[A-Za-z0-9_-]+$/, "Lien Medal attendu : https://medal.tv/u/profil")
      .nullable(),
  }),
});
