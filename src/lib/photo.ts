import type { ImageMetadata } from "astro";

type Module = { default: ImageMetadata };

/**
 * Photo du héros.
 * Déposer la vraie photo (détourée, noir et blanc, sans métadonnées) sous :
 *   src/assets/photo/ryan-cardamone.png (ou .webp / .jpg / .avif)
 * Elle remplace alors automatiquement la silhouette temporaire.
 */
const reelle = Object.values(
  import.meta.glob<Module>("../assets/photo/ryan-cardamone.{png,webp,avif,jpg,jpeg}", { eager: true }),
)[0];
const temporaire = Object.values(
  import.meta.glob<Module>("../assets/photo/photo-temporaire.png", { eager: true }),
)[0];

const choisie = reelle ?? temporaire;
if (!choisie) throw new Error("Aucune photo trouvée dans src/assets/photo/.");

export const heroPhoto = {
  src: choisie.default,
  alt: reelle ? "Portrait de Ryan Cardamone" : "Silhouette temporaire, en attendant le portrait de Ryan Cardamone",
  temporaire: !reelle,
};
