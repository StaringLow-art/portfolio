import { parcoursSchema } from "../schemas/parcours.ts";

/**
 * Parcours et compétences de Ryan (contenu fourni par Ryan, tel quel).
 * Le schéma vérifie le format à chaque « npm run check ».
 */
export const parcours = parcoursSchema.parse({
  introduction:
    "Informaticien CFC spécialisé en exploitation et infrastructure, je m'intéresse au fonctionnement des infrastructures informatiques, à la résolution de problèmes techniques et à l'apprentissage de nouvelles technologies. J'aime travailler de manière autonome comme en équipe, et apporter des solutions concrètes aux utilisateurs.",
  recherche:
    "Exploitation informatique, support N1/N2, administration systèmes et réseaux, virtualisation ou infrastructure IT.",
  etapes: [
    {
      type: "formation",
      periode: "Août 2022 – juin 2026",
      titre: "CFC d'informaticien, exploitation et infrastructure",
      organisation: "Centre professionnel du Nord vaudois",
      description: "Travail pratique individuel : 5.6/6.",
    },
    {
      type: "experience",
      periode: "Février 2025 – janvier 2026",
      titre: "Stagiaire informaticien, service informatique",
      organisation: "Ville de Renens",
      taches: [
        "Support aux utilisateurs (helpdesk N1 et N2)",
        "Préparation, installation et configuration de postes de travail et de matériel",
        "Diagnostic et dépannage sur site",
        "Support de la téléphonie d'entreprise (PBX)",
        "Documentation des interventions, des procédures et des produits techniques",
        "Tests et mise en place de nouveaux équipements",
        "Participation à la refonte du réseau de la Ville et installation d'équipements réseau",
        "Préparation et déploiement de mobiles Android professionnels gérés avec Microsoft Intune et Entra",
      ],
    },
  ],
  competences: [
    {
      groupe: "Systèmes et virtualisation",
      elements: ["machines virtuelles", "Proxmox VE", "administration Linux", "Windows"],
    },
    {
      groupe: "Supervision",
      elements: ["PRTG Network Monitor", "SNMPv3", "WMI", "SSH"],
    },
    {
      groupe: "Support",
      elements: ["helpdesk N1/N2", "diagnostic", "dépannage", "documentation"],
    },
    {
      groupe: "Environnement Microsoft",
      elements: ["Intune", "Entra"],
    },
    {
      groupe: "Réseau et téléphonie",
      elements: ["installation d'équipements réseau", "PBX"],
    },
  ],
});
