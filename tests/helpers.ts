import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export const SITE_ORIGIN = "http://localhost:4321";

const DIST = path.join(process.cwd(), "dist");

/**
 * Univers Sport publié ? (introduction remplie → dist/sport/ généré).
 * Les tests s'adaptent : masqué, ils vérifient qu'il n'apparaît nulle part ;
 * publié, ils testent ses pages comme les autres.
 */
export const SPORT_PUBLIE = existsSync(path.join(DIST, "sport", "index.html"));

/** Pages de courses publiées, d'après le site généré. */
export const PAGES_COURSES = SPORT_PUBLIE
  ? readdirSync(path.join(DIST, "sport"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(DIST, "sport", d.name, "index.html")))
      .map((d) => `/sport/${d.name}/`)
      .sort()
  : [];

/** Pages publiques à tester. */
export const PAGES = [
  "/",
  "/pro/",
  "/jeux/",
  ...(SPORT_PUBLIE ? ["/sport/", ...PAGES_COURSES] : []),
  "/projets/homelab/",
  "/projets/projet-cfc/",
  "/contact/",
];

/** Menu attendu, selon les univers publiés. */
export const MENU = ["Accueil", "Pro", "Jeux", ...(SPORT_PUBLIE ? ["Sport"] : []), "Contact"];

/** Titres des cartes Univers de l'accueil, selon les univers publiés. */
export const CARTES_UNIVERS = ["Professionnel", "Jeux", ...(SPORT_PUBLIE ? ["Sport"] : [])];

/** Anciennes adresses, redirigées vers une section de la page Pro. */
export const ANCIENNES_ADRESSES = [
  { from: "/projets/", to: "/pro/#projets", section: "#projets" },
  { from: "/parcours/", to: "/pro/#parcours", section: "#parcours" },
] as const;

/**
 * Enregistre les erreurs console et les requêtes vers un autre domaine.
 * À appeler avant page.goto().
 */
export function watchPage(page: Page) {
  const consoleErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (!["http:", "https:"].includes(url.protocol)) return;
    if (url.origin !== SITE_ORIGIN) externalRequests.push(req.url());
  });
  return { consoleErrors, externalRequests };
}
