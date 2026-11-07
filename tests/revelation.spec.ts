import { expect, test, type Page } from "@playwright/test";

/**
 * Révélation des images de /projets : une seule fois par affichage de page,
 * et une image visible ne redevient JAMAIS cachée.
 *
 * Une sonde est installée au tout début de chaque document. À chaque image
 * d'affichage (requestAnimationFrame), elle note pour chaque image à l'écran :
 *  - le moment où elle apparaît à l'écran ;
 *  - le moment où elle devient visible (cache retiré ET image chargée) ;
 *  - tout retour à l'état caché après être devenue visible.
 * Le test attend au moins 8 s après l'apparition de chaque image.
 *
 * Exécuté dans Chromium et Firefox (voir playwright.config.ts).
 */

// Réactive le bfcache (désactivé par défaut par Playwright dans Chromium),
// pour que le retour arrière se comporte comme dans un vrai navigateur.
test.use({ launchOptions: { ignoreDefaultArgs: ["--disable-back-forward-cache"] } });

type Record = { onScreenSince: number; firstVisible: number | null; rehidden: number[] };

const MONITOR = () => {
  const w = window as unknown as { __reveal?: Record[] };
  if (w.__reveal) return;
  const data: Record[] = [];
  w.__reveal = data;
  const isCovered = (el: Element) => {
    const cs = getComputedStyle(el, "::after");
    if (cs.content === "none" || cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    if (cs.transform === "none") return true;
    return parseFloat(cs.transform.split(",")[3] ?? "1") > 0.02;
  };
  const tick = () => {
    const t = performance.now();
    document.querySelectorAll(".card__media").forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (!(r.bottom > 0 && r.top < window.innerHeight && r.width > 0)) return;
      const img = el.querySelector("img");
      const visible = !isCovered(el) && !!img && img.complete && img.naturalWidth > 0;
      const rec = (data[i] ??= { onScreenSince: t, firstVisible: null, rehidden: [] });
      if (visible && rec.firstVisible === null) rec.firstVisible = t;
      if (!visible && rec.firstVisible !== null) rec.rehidden.push(Math.round(t));
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/** Attend 8 s de surveillance après l'apparition de chaque image, puis vérifie. */
async function expectNeverRehidden(page: Page) {
  const since = await page.evaluate(() => performance.now());
  const read = () =>
    page.evaluate(() => ({
      now: performance.now(),
      data: ((window as unknown as { __reveal?: Record[] }).__reveal ?? []).filter(Boolean),
    }));

  await expect
    .poll(
      async () => {
        const { now, data } = await read();
        if (data.length === 0) return false;
        return data.every((r) => r.firstVisible !== null && now - Math.max(r.firstVisible, since) >= 8000);
      },
      { timeout: 15_000, intervals: [500] },
    )
    .toBe(true);

  const { data } = await read();
  for (const [i, r] of data.entries()) {
    // Une image visible ne redevient jamais cachée
    expect(r.rehidden, `image ${i} redevenue cachée`).toEqual([]);
    // Révélée rapidement après son apparition à l'écran
    expect(r.firstVisible! - r.onScreenSince, `image ${i} révélée trop tard`).toBeLessThanOrEqual(1500);
  }
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test.describe(`/pro à ${viewport.width} px : une image visible ne redevient jamais cachée`, () => {
    test.use({ viewport });
    test.setTimeout(45_000);

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(MONITOR);
    });

    // « PROFESSIONNEL » repousse les projets sous le premier écran : arrivée sur
    // /pro/#projets (redirection de l'ancienne page /projets/, lien « Tous les projets »)
    test("arrivée directe", async ({ page }) => {
      await page.goto("/pro/#projets");
      await expectNeverRehidden(page);
    });

    test("rechargement", async ({ page }) => {
      await page.goto("/pro/#projets");
      await page.waitForTimeout(1500);
      await page.reload();
      await expectNeverRehidden(page);
    });

    test("navigation depuis une autre page", async ({ page }) => {
      await page.goto("/projets/homelab/");
      await page.getByRole("link", { name: "Tous les projets" }).click();
      await expect(page).toHaveURL(/\/pro\/#projets$/);
      await expectNeverRehidden(page);
    });

    test("retour arrière", async ({ page }) => {
      await page.goto("/pro/#projets");
      await page.waitForTimeout(1500);
      await page.locator(".card__title a").first().click();
      await expect(page).toHaveURL(/\/projets\/homelab\/$/);
      await page.waitForTimeout(500);
      // « commit » : une page restaurée depuis le bfcache ne déclenche pas « load »
      await page.goBack({ waitUntil: "commit" });
      await expect(page).toHaveURL(/\/pro\/#projets$/);
      await expectNeverRehidden(page);
    });
  });
}
