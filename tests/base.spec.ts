import { readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PAGES, watchPage } from "./helpers";

for (const url of PAGES) {
  test(`page ${url} : chargement, h1 unique, langue, sans erreur ni requête externe`, async ({ page }) => {
    const watched = watchPage(page);
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main#contenu")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(watched.consoleErrors).toEqual([]);
    expect(watched.externalRequests).toEqual([]);
  });
}

test("Moto Passion (draft) n'est ni publié, ni dans le sitemap, ni dans dist/", async ({ page, request }) => {
  const response = await page.goto("/projets/moto-passion/");
  expect(response?.status()).toBe(404);
  await page.goto("/projets/");
  await expect(page.getByText("Moto Passion")).toHaveCount(0);

  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  expect(sitemap).toContain("/projets/");
  expect(sitemap).not.toContain("moto-passion");

  const distFiles = readdirSync(path.join(process.cwd(), "dist"), { recursive: true }).map(String);
  expect(distFiles.filter((f) => f.includes("moto-passion"))).toEqual([]);
});

test("la navigation indique la page active", async ({ page }) => {
  await page.goto("/parcours/");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav.getByRole("link", { name: "Parcours" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current", /.+/);
});

test("le bouton de thème propose le thème opposé et conserve le choix", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.locator("[data-theme-toggle]");
  await expect(toggle).toHaveAccessibleName("Thème sombre");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAccessibleName("Thème clair");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAccessibleName("Thème clair");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAccessibleName("Thème sombre");
});

test("en préférence sombre, le bouton propose « Thème clair »", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("[data-theme-toggle]")).toHaveAccessibleName("Thème clair");
});
