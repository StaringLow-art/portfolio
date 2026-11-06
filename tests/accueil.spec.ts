import { expect, test } from "@playwright/test";

const WIDTHS = [320, 375, 768, 1024, 1440, 1920, 2000, 2560];

test.describe("héros : géométrie", () => {
  test.use({ reducedMotion: "reduce" });

  for (const width of WIDTHS) {
    test(`${width} px : nom pleine largeur, marges égales, portrait sans coupe dans les lettres`, async ({ page }) => {
      await page.setViewportSize({ width, height: width >= 2560 ? 1440 : 900 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".hero__figure img").evaluate((img: HTMLImageElement) => img.decode());

      const g = await page.evaluate(() => {
        const r = (el: Element | null) => el!.getBoundingClientRect();
        const stage = r(document.querySelector(".hero__stage"));
        const inner = r(document.querySelector(".hero__name-inner"));
        const lines = [...document.querySelectorAll(".hero__line")].map((l) => l.getBoundingClientRect());
        const figure = r(document.querySelector(".hero__figure"));
        const slab = r(document.querySelector(".hero__slab"));
        const info = [...document.querySelectorAll(".hero__role, .hero__facts > li, .hero__actions a")].map((e) =>
          e.getBoundingClientRect(),
        );
        const covers = info.some(
          (b) => !(b.right <= figure.left || b.left >= figure.right || b.bottom <= figure.top || b.top >= figure.bottom),
        );
        // Ce qui est réellement au premier plan sur chaque information doit être cette information
        const infoEls = [...document.querySelectorAll(".hero__role, .hero__facts li, .hero__actions a")];
        const obscured = infoEls.filter((el) => {
          // Un rectangle par ligne de texte réellement occupée
          const points = [...el.getClientRects()].flatMap((b) => [
            [b.left + 2, b.top + 2],
            [b.right - 2, b.top + 2],
            [b.left + 2, b.bottom - 2],
            [b.right - 2, b.bottom - 2],
            [b.left + b.width / 2, b.top + b.height / 2],
          ]);
          return points.some(([x, y]) => {
            const top = document.elementFromPoint(x!, y!);
            // Masqué seulement par un élément extérieur (ni lui-même, ni un descendant, ni un parent)
            return top !== null && top !== el && !el.contains(top) && !top.contains(el);
          });
        }).length;
        return {
          scrollOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          clientWidth: document.documentElement.clientWidth,
          stageWidth: stage.width,
          left: inner.left,
          right: document.documentElement.clientWidth - inner.right,
          innerWidth: inner.width,
          lineTops: [...new Set(lines.map((l) => Math.round(l.top)))],
          nameBottom: inner.bottom,
          figureBottom: figure.bottom,
          slabBottom: slab.bottom,
          covers,
          obscured,
          figureTop: figure.top,
          figureWidth: figure.width,
          figureHeight: figure.height,
          heroTop: document.querySelector(".hero")!.getBoundingClientRect().top,
          nativeWidth: Number(document.querySelector(".hero__figure img")!.getAttribute("width")),
          nativeHeight: Number(document.querySelector(".hero__figure img")!.getAttribute("height")),
        };
      });

      expect(g.scrollOverflow).toBe(0);
      // Marges égales à gauche et à droite (±2 px)
      expect(Math.abs(g.left - g.right)).toBeLessThanOrEqual(2);
      // Toute la largeur utile (au moins 95 % de la scène)
      expect(g.innerWidth / g.stageWidth).toBeGreaterThan(0.95);
      expect(g.innerWidth).toBeLessThanOrEqual(g.stageWidth + 0.5);
      // Deux lignes sur téléphone, une seule à partir de 768 px
      expect(g.lineTops.length).toBe(width < 768 ? 2 : 1);
      // Le portrait se termine sur le bord bas de l'aplat
      expect(Math.abs(g.figureBottom - g.slabBottom)).toBeLessThanOrEqual(1);
      // …et jamais au milieu des lettres : entre les deux lignes, ou sous le nom
      const line2Top = g.lineTops[1];
      const betweenLines = line2Top !== undefined && g.figureBottom <= line2Top + 1;
      expect(betweenLines || g.figureBottom >= g.nameBottom - 1).toBe(true);
      // Métier, région, disponibilité et boutons jamais recouverts
      expect(g.covers).toBe(false);
      expect(g.obscured).toBe(0);
      // Le haut de la tête n'est jamais coupé : le portrait reste dans le héros
      expect(g.figureTop, "portrait entièrement dans le héros").toBeGreaterThanOrEqual(g.heroTop);
      // Jamais affiché au-delà de sa résolution native, proportions conservées
      expect(g.figureWidth).toBeLessThanOrEqual(g.nativeWidth);
      expect(Math.abs(g.figureWidth / g.figureHeight - g.nativeWidth / g.nativeHeight)).toBeLessThan(0.01);
      // Fenêtre de 2000 px : environ 720 px de haut
      if (width === 2000) {
        expect(g.figureHeight).toBeGreaterThanOrEqual(700);
        expect(g.figureHeight).toBeLessThanOrEqual(740);
      }
    });
  }
});

test.describe("images de projets : toujours révélées", () => {
  /** Vrai si le cache bordeaux recouvre encore l'image n° index. */
  const covered = (index: number) => `(() => {
    const cs = getComputedStyle(document.querySelectorAll('.card__media')[${index}], '::after');
    if (cs.content === 'none' || cs.display === 'none') return false;
    return cs.transform === 'none' || parseFloat(cs.transform.split(',')[3]) > 0.02;
  })()`;

  test("révélées au défilement, une seule fois", async ({ page }) => {
    await page.goto("/");
    const count = await page.locator(".card__media").count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const media = page.locator(".card__media").nth(i);
      await media.scrollIntoViewIfNeeded();
      await expect(media).toHaveAttribute("data-revealed", "true");
      // Ce test vérifie que la révélation a lieu (une fois). Sa vitesse (< 1,5 s)
      // est contrôlée dans details.spec.ts et revelation.spec.ts. Délai de 5 s
      // (valeur par défaut de Playwright) : 2 s s'est montré trop juste une fois
      // sous la charge de la suite complète lancée en parallèle.
      await expect.poll(() => page.evaluate(covered(i)), { timeout: 5000 }).toBe(false);
      await expect.poll(() => media.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
  });

  test("hors écran, l'image reste cachée jusqu'à son arrivée à l'écran", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/");
    const last = (await page.locator(".card__media").count()) - 1;
    await page.waitForTimeout(1000);
    expect(await page.evaluate(covered(last))).toBe(true);
    await page.locator(".card__media").nth(last).scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(covered(last)), { timeout: 2000 }).toBe(false);
  });

  test("sécurité : si le script de révélation ne démarre pas, aucun cache après 3 s", async ({ page }) => {
    // Retire le script de révélation de la page pour simuler une panne
    await page.route("**/", async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script type="module">(?:(?!<\/script>)[\s\S])*__revealReady(?:(?!<\/script>)[\s\S])*<\/script>/, "");
      await route.fulfill({ response, body: html });
    });
    await page.goto("/");
    expect(await page.evaluate(() => "__revealReady" in window)).toBe(false);
    await expect.poll(() => page.locator("html").getAttribute("class"), { timeout: 4000 }).not.toContain("reveal-pending");
    expect(await page.evaluate(covered(0))).toBe(false);
  });

  test("aucun cache avec mouvement réduit", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/reveal-pending/);
    expect(await page.evaluate(covered(0))).toBe(false);
  });
});
test.describe("sans JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("images visibles, bouton de thème caché, CV accessible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/reveal-pending/);
    await expect(page.locator("[data-theme-toggle]")).toBeHidden();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: /Télécharger le CV/ })).toBeVisible();
  });
});
