/**
 * Univers du site, dans l'ordre du menu et de l'accueil.
 * Pour ajouter Musique ou Loisirs plus tard : créer la page
 * src/pages/<slug>.astro, puis ajouter une entrée ici.
 */
import { sportPublie } from "../lib/sport";

export type Univers = {
  /** Adresse de la page : /<slug>/ */
  slug: string;
  /** Nom complet (grand titre de la page et de la carte, onglet du navigateur). */
  titre: string;
  /** Nom court dans le menu, si différent du titre. */
  menu?: string;
  /** Une phrase de présentation, affichée sur l'accueil. */
  resume: string;
  /** Adresses rattachées à cet univers dans le menu (ex. pages de projets). */
  sousPages?: string[];
  /** false = univers masqué (ni menu, ni carte, ni page). Défaut : visible. */
  visible?: boolean;
};

export const univers: Univers[] = [
  {
    slug: "pro",
    titre: "Professionnel",
    menu: "Pro",
    // Espace insécable avant « : » : jamais de deux-points en début de ligne
    resume: "Informaticien CFC en exploitation et infrastructure : projets, parcours et CV.",
    sousPages: ["/projets/"],
  },
  {
    slug: "jeux",
    titre: "Jeux",
    resume: "Mes jeux favoris, ma bibliothèque Steam et mes clips.",
  },
  {
    slug: "sport",
    titre: "Sport",
    resume: "Le karting, mes courses et mon calendrier.",
    // Publié seulement quand src/content/sport/introduction.md est rempli
    visible: sportPublie(),
  },
];

/** Univers publiés, dans l'ordre : menu, cartes de l'accueil. */
export const universPublies = univers.filter((u) => u.visible !== false);
