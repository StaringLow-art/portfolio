/**
 * Métriques de la police Anton (titres), mesurées dans le navigateur, en em.
 * Elles servent à calculer, pendant la génération du site :
 *  - la taille maximale d'un titre pour que son mot le plus long tienne
 *    sur une ligne (jamais coupé au milieu) ;
 *  - l'alignement d'un numéro sur le haut des capitales d'un titre.
 */

/** Hauteur des capitales et marges de la police (em). */
export const ANTON = { ascent: 1.176, descent: 0.329, cap: 0.859 } as const;

/** Espacement des lettres des titres (global.css : letter-spacing 0.005em). */
const ESPACEMENT = 0.005;

/** Largeur d'avance des caractères des titres en capitales (em). */
const LARGEURS: Record<string, number> = {
  A: 0.485, B: 0.479, C: 0.474, D: 0.493, E: 0.412, F: 0.399, G: 0.485, H: 0.499, I: 0.227,
  J: 0.466, K: 0.472, L: 0.397, M: 0.746, N: 0.498, O: 0.486, P: 0.472, Q: 0.494, R: 0.477,
  S: 0.461, T: 0.396, U: 0.474, V: 0.469, W: 0.712, X: 0.484, Y: 0.446, Z: 0.41,
  "0": 0.494, "1": 0.331, "2": 0.494, "3": 0.494, "4": 0.494, "5": 0.494, "6": 0.494, "7": 0.494,
  "8": 0.494, "9": 0.494, À: 0.485, Â: 0.485, Ä: 0.485, Ç: 0.474, É: 0.412, È: 0.412, Ê: 0.412,
  Ë: 0.412, Î: 0.227, Ï: 0.227, Ô: 0.486, Ö: 0.486, Ù: 0.474, Û: 0.474, Ü: 0.474,
  "'": 0.214, "’": 0.214, "-": 0.311, ":": 0.242, ".": 0.242, ",": 0.242,
};
/** Caractère inconnu : on prend la lettre la plus large (sécurité). */
const PAR_DEFAUT = 0.746;

/** Largeur d'un mot en capitales Anton (em), espacement compris. */
export function largeurEm(mot: string): number {
  return [...mot.toUpperCase()].reduce((s, c) => s + (LARGEURS[c] ?? PAR_DEFAUT) + ESPACEMENT, 0);
}

/** Largeur du mot le plus long d'un texte (em). */
export function motLePlusLongEm(texte: string): number {
  return Math.max(0, ...texte.split(/\s+/).filter(Boolean).map(largeurEm));
}

/**
 * Décalage (en fractions de taille de police) entre le haut d'une ligne et le
 * haut des capitales, pour une interligne donnée en em.
 * haut des capitales = interligne / 2 − (ascent + descent) / 2 + (ascent − cap)
 */
export const HAUT_CAPITALES = (ANTON.ascent - ANTON.cap) - (ANTON.ascent + ANTON.descent) / 2;
