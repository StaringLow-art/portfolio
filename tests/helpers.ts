import type { Page } from "@playwright/test";

export const SITE_ORIGIN = "http://localhost:4321";

/** Pages publiques à tester. Complétée automatiquement avec les projets en phase 4. */
export const PAGES = ["/", "/projets/", "/projets/homelab/", "/projets/projet-cfc/", "/parcours/", "/contact/"];

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
