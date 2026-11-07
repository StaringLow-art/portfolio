import { expect, test } from "@playwright/test";
import { PAGES } from "./helpers";

const EMAIL = "contact@cardamone-online.ch";
const PRIVACY_URL =
  "https://docs.github.com/fr/pages/getting-started-with-github-pages/what-is-github-pages#data-collection";

test.describe("Projets", () => {
  test("la mosaïque numérote les projets publiés « 01 », « 02 »", async ({ page }) => {
    await page.goto("/pro/");
    await expect(page.locator(".card")).toHaveCount(2);
    await expect(page.locator(".card__num")).toHaveText(["01", "02"]);
    await expect(page.locator(".card h3")).toHaveCount(2);
    // Titre et résumé lisibles sans survol
    for (const card of await page.locator(".card").all()) {
      await expect(card.locator(".card__title")).toBeVisible();
      await expect(card.locator(".card__summary")).toBeVisible();
    }
  });

  test("page détail : numéro, titre, fiche, image, pas de section Documents vide", async ({ page }) => {
    await page.goto("/projets/homelab/");
    await expect(page.locator(".projet__num")).toHaveText("01");
    await expect(page.locator(".projet__next .label")).toHaveText("Projet suivant · 02");
    await expect(page.locator("h1")).toHaveText("Homelab");
    await expect(page.getByText("Rôle", { exact: true })).toBeVisible();
    await expect(page.getByText("Technologies", { exact: true })).toBeVisible();
    await expect
      .poll(() => page.locator(".projet__cover img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    await expect(page.locator("#titre-documents")).toHaveCount(0);
    await expect(page.locator("iframe, video")).toHaveCount(0);
    await page.getByRole("link", { name: /Projet suivant/ }).click();
    await expect(page).toHaveURL(/\/projets\/projet-cfc\/$/);
  });
});

test("Pro : lien vers le CV", async ({ page }) => {
  await page.goto("/pro/");
  await expect(page.getByRole("link", { name: /Télécharger le CV/ })).toHaveAttribute("href", "/Ryan-Cardamone-CV.pdf");
});

test.describe("Contact", () => {
  test("adresse en texte, mailto, CV, mention de confidentialité, liens renseignés seulement", async ({ page }) => {
    await page.goto("/contact/");
    await expect(page.locator("#adresse-email")).toHaveText(EMAIL);
    await expect(page.getByRole("link", { name: "Envoyer un e-mail" })).toHaveAttribute("href", `mailto:${EMAIL}`);
    await expect(page.getByRole("link", { name: /Télécharger le CV/ })).toBeVisible();
    const privacy = page.locator(".contact__privacy");
    await expect(privacy).toContainText("Ce site n'utilise ni cookies ni outil de statistiques.");
    await expect(privacy.getByRole("link", { name: "En savoir plus" })).toHaveAttribute("href", PRIVACY_URL);
    // site.ts : github à null → jamais affiché ; linkedin renseigné → affiché une fois
    await expect(page.locator('a[href*="github.com"]:not([href^="https://docs.github.com"])')).toHaveCount(0);
    await expect(page.locator("#titre-liens")).toHaveCount(1);
    const linkedin = page.getByRole("link", { name: "LinkedIn" });
    await expect(linkedin).toHaveCount(1);
    await expect(linkedin).toHaveAttribute("href", "https://www.linkedin.com/in/ryancardamone/");
  });

  test("« Copier l'adresse » copie et l'annonce", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/contact/");
    await page.getByRole("button", { name: "Copier l'adresse" }).click();
    await expect(page.getByRole("status")).toHaveText("Adresse copiée dans le presse-papiers.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
  });

  test("échec de la copie : message de sélection manuelle et adresse sélectionnée", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("refusé")) },
        configurable: true,
      });
    });
    await page.goto("/contact/");
    await page.getByRole("button", { name: "Copier l'adresse" }).click();
    await expect(page.getByRole("status")).toContainText("copier manuellement");
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(EMAIL);
  });

  test("aucun cookie, même après changement de thème", async ({ page, context }) => {
    await page.goto("/contact/");
    await page.locator("[data-theme-toggle]").click();
    await page.reload();
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe("");
  });
});

test.describe("sans JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("Contact : bouton de copie caché, adresse et mailto disponibles", async ({ page }) => {
    await page.goto("/contact/");
    await expect(page.locator("[data-copy-email]")).toBeHidden();
    await expect(page.locator("#adresse-email")).toHaveText(EMAIL);
    await expect(page.getByRole("link", { name: "Envoyer un e-mail" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Télécharger le CV/ })).toBeVisible();
  });
});

test("404 : statut, titre, retour à l'accueil, non indexée", async ({ page }) => {
  const response = await page.goto("/cette-page-n-existe-pas/");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page introuvable");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await page.getByRole("link", { name: "Retour à l'accueil" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("le CV se télécharge", async ({ page }) => {
  await page.goto("/pro/");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Télécharger le CV/ }).first().click(),
  ]);
  expect(download.suggestedFilename()).toBe("Ryan-Cardamone-CV.pdf");
});

test("tous les liens internes répondent 200", async ({ page, request }) => {
  const links = new Set<string>();
  for (const url of [...PAGES, "/cette-page-n-existe-pas/"]) {
    await page.goto(url);
    for (const href of await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) {
      if (href.startsWith("/") && !href.startsWith("//")) links.add(href.split("#")[0]!);
    }
  }
  expect(links.size).toBeGreaterThan(5);
  for (const href of links) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
  }
});
