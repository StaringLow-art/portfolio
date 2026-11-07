export const site = {
  name: "Ryan Cardamone",
  /** Présentation de l'accueil (titre de page et héros). */
  presentation: "Informaticien, pilote, gamer et passionné de musique",
  /** Métier, affiché sur la page Pro. */
  role: "Informaticien CFC — exploitation et infrastructure",
  location: "Lausanne",
  availability:
    "Disponible dès maintenant jusqu'en février 2027. Service militaire de février à décembre 2027, avec une poursuite possible ensuite.",
  email: "contact@cardamone-online.ch",
  cvPath: "/Ryan-Cardamone-CV.pdf",
  links: {
    github: null,
    linkedin: "https://www.linkedin.com/in/ryancardamone/",
  },
  /** Profils de jeu, affichés sur la page Jeux (liens externes simples). */
  jeux: {
    steam: "https://steamcommunity.com/id/W1mdra_/",
    medal: "https://medal.tv/u/W1mdra_",
  },
} as const;
