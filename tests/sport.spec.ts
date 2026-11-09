import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { aujourdhui, courseVisible, dateEnLettres, introductionRemplie, prochainesCourses } from "../src/lib/sport.ts";
import { PAGES_COURSES, SPORT_PUBLIE, watchPage } from "./helpers";

/* ======================================================================
   Règles (sans navigateur)
   ====================================================================== */
test.describe("Sport : règles", () => {
  test("publication : seulement si l'introduction est remplie", () => {
    expect(introductionRemplie("---\n# commentaire\n---\n\nÀ_COMPLÉTER\n")).toBe(false);
    expect(introductionRemplie("---\n# commentaire\n---\n\n   \n")).toBe(false);
    expect(introductionRemplie("Un vrai texte, mais À_COMPLÉTER encore.")).toBe(false);
    expect(introductionRemplie("---\n# commentaire À_COMPLÉTER\n---\nMon texte.")).toBe(true);
    expect(introductionRemplie("Mon texte.")).toBe(true);
  });

  test("calendrier : dates passées masquées, aujourd'hui gardé, ordre chronologique", () => {
    const cal = [
      { date: "2026-12-05", circuit: "C", evenement: "Plus tard" },
      { date: "2026-11-01", circuit: "A", evenement: "Passée" },
      { date: "2026-11-08", circuit: "B", evenement: "Aujourd'hui" },
    ];
    expect(prochainesCourses(cal, "2026-11-08").map((c) => c.evenement)).toEqual(["Aujourd'hui", "Plus tard"]);
    expect(prochainesCourses([], "2026-11-08")).toEqual([]);
    expect(prochainesCourses([cal[1]!], "2026-11-08")).toEqual([]);
  });

  test("dates : « 1er novembre 2026 », jour de Lausanne au format AAAA-MM-JJ", () => {
    expect(dateEnLettres("2026-11-01")).toBe("1er novembre 2026");
    expect(dateEnLettres("2026-12-15")).toBe("15 décembre 2026");
    expect(dateEnLettres(new Date("2026-11-01T00:00:00Z"))).toBe("1er novembre 2026");
    // 23 h 30 UTC le 7 novembre = 0 h 30 le 8 novembre à Lausanne
    expect(aujourdhui(new Date("2026-11-07T23:30:00Z"))).toBe("2026-11-08");
  });
});

/* ======================================================================
   Univers masqué (introduction à compléter) : invisible partout
   ====================================================================== */
test.describe("Sport masqué", () => {
  test.skip(SPORT_PUBLIE, "l'univers Sport est publié");

  test("ni page, ni menu, ni carte, ni sitemap", async ({ page, request }) => {
    expect((await request.get("/sport/")).status()).toBe(404);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Sport" })).toHaveCount(0);
    await expect(page.locator('a[href^="/sport/"]')).toHaveCount(0);
    const sitemap = await (await request.get("/sitemap-0.xml")).text();
    expect(sitemap).not.toContain("/sport/");
  });
});

/* ======================================================================
   Course d'exemple : seulement en développement local, jamais publiée
   ====================================================================== */
test("course d'exemple : visible en développement seulement (règle)", () => {
  expect(courseVisible({ draft: false, exemple: true }, true)).toBe(true);
  expect(courseVisible({ draft: false, exemple: true }, false)).toBe(false);
  expect(courseVisible({ draft: true, exemple: false }, true)).toBe(false);
  expect(courseVisible({ draft: false, exemple: false }, false)).toBe(true);
});

test("course d'exemple : absente du build de production, du sitemap et des pages", async ({ page, request }) => {
  expect((await request.get("/sport/course-d-exemple/")).status()).toBe(404);
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  expect(sitemap).not.toContain("course-d-exemple");
  // Aucun fichier (page, photo) ni aucune mention dans le site généré
  const dist = path.join(process.cwd(), "dist");
  const fichiers = readdirSync(dist, { recursive: true }).map(String);
  expect(fichiers.filter((f) => /course-d-exemple/i.test(f))).toEqual([]);
  for (const f of fichiers.filter((f) => /\.(html|xml|txt|json)$/.test(f))) {
    const contenu = readFileSync(path.join(dist, f), "utf8");
    expect(contenu, f).not.toContain("course-d-exemple");
    expect(contenu, f).not.toContain("Course d'exemple");
    expect(contenu, f).not.toContain("example.com/video-d-exemple");
  }
  // Ni dans la page Sport (si elle existe), ni bandeau « EXEMPLE »
  if (SPORT_PUBLIE) {
    await page.goto("/sport/");
    await expect(page.locator("main")).not.toContainText("EXEMPLE");
    await expect(page.locator(".carnet__exemple, .bandeau-exemple")).toHaveCount(0);
  }
});

/* ======================================================================
   Univers publié : page /sport/ et pages de courses
   ====================================================================== */
test.describe("Sport publié", () => {
  test.skip(!SPORT_PUBLIE, "univers Sport masqué (introduction à compléter)");

  test("/sport/ : sections, calendrier à venir, courses de la plus récente à la plus ancienne", async ({ page }) => {
    await page.goto("/sport/");
    await expect(page.locator("h1")).toHaveText("Sport");
    await expect(page.getByRole("heading", { level: 2, name: "Pourquoi le karting" })).toBeVisible();
    await expect(page.locator(".sport__pourquoi .prose")).not.toBeEmpty();
    await expect(page.locator("main")).not.toContainText("À_COMPLÉTER");

    // Prochaines courses : aucune date passée, ordre chronologique, ou message sobre
    const dates = await page.locator(".calendrier__date").evaluateAll((els) => els.map((e) => e.getAttribute("datetime")!));
    if (dates.length === 0) {
      await expect(page.locator("#calendrier")).toContainText("Aucune course prévue pour le moment");
    } else {
      for (const d of dates) expect(d >= aujourdhui()).toBe(true);
      expect(dates).toEqual([...dates].sort());
    }

    // Courses : de la plus récente à la plus ancienne ; liens vers leurs pages
    const courses = await page.locator(".carnet__date").evaluateAll((els) => els.map((e) => e.getAttribute("datetime")!));
    expect(courses).toEqual([...courses].sort().reverse());
    const liens = await page.locator(".carnet__titre a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(liens.sort()).toEqual([...PAGES_COURSES].sort());
    if (liens.length === 0) await expect(page.locator("#courses")).toContainText("Aucune course publiée pour le moment");
    // Section Compétences retirée (tout est dans l'introduction)
    await expect(page.getByRole("heading", { name: "Compétences" })).toHaveCount(0);
    // Champs facultatifs vides : rien d'affiché
    await expect(page.locator(".carnet__meta span:empty")).toHaveCount(0);
  });

  test("menu : Sport actif sur /sport/ et sur une page de course", async ({ page }) => {
    for (const url of ["/sport/", ...PAGES_COURSES.slice(0, 1)]) {
      await page.goto(url);
      const lien = page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Sport" });
      await expect(lien, url).toHaveAttribute("aria-current", url === "/sport/" ? "page" : "true");
    }
  });

  for (const url of PAGES_COURSES) {
    test(`${url} : fiche, champs vides masqués, vidéos en liens, galerie accessible`, async ({ page }) => {
      const watched = watchPage(page);
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      expect(watched.externalRequests).toEqual([]);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator(".course__date time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
      // Aucun champ vide affiché
      for (const dd of await page.locator(".course__fiche dd").allTextContents()) expect(dd.trim()).not.toBe("");
      // Vidéos : liens externes uniquement, aucun lecteur
      await expect(page.locator("iframe, video, embed, object")).toHaveCount(0);
      for (const href of await page.locator(".course__videos a").evaluateAll((els) => els.map((e) => e.getAttribute("href")!))) {
        expect(href).toMatch(/^https:\/\//);
      }

      const vignettes = page.locator(".galerie__lien");
      const n = await vignettes.count();
      if (n === 0) {
        await expect(page.locator("#titre-photos")).toHaveCount(0);
        return;
      }
      // Texte alternatif obligatoire, images optimisées (WebP générées par Astro)
      for (const img of await page.locator(".galerie__lien img").all()) {
        expect((await img.getAttribute("alt"))?.trim()).toBeTruthy();
        expect(await img.getAttribute("src")).toMatch(/\/_astro\/.+\.webp$/);
      }

      // Clavier : Tab jusqu'à la 1re vignette, Entrée ouvre la visionneuse
      const dialog = page.locator("dialog.visionneuse");
      await vignettes.first().focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveAttribute("open", "");
      await expect(page.getByRole("button", { name: "Fermer" })).toBeFocused();
      await expect(dialog.locator("img")).toHaveAttribute("alt", (await page.locator(".galerie__lien img").first().getAttribute("alt"))!);
      await expect
        .poll(() => dialog.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
        .toBe(true);
      // La photo affichée (entière) ne recouvre jamais la barre de boutons
      const g = await dialog.evaluate((d) => {
        const img = d.querySelector("img")!;
        const r = img.getBoundingClientRect();
        // Zone réellement occupée par la photo (object-fit: contain)
        const echelle = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
        const hauteur = img.naturalHeight * echelle;
        const basPhoto = r.top + (r.height - hauteur) / 2 + hauteur;
        return { basPhoto, hautBarre: d.querySelector(".visionneuse__barre")!.getBoundingClientRect().top, basEcran: innerHeight };
      });
      expect(g.basPhoto).toBeLessThanOrEqual(g.hautBarre);
      expect(g.basPhoto).toBeLessThanOrEqual(g.basEcran);
      if (n > 1) {
        await page.keyboard.press("ArrowRight");
        await expect(dialog.locator("[data-visionneuse-compteur]")).toHaveText(`Photo 2 sur ${n}`);
        await page.keyboard.press("ArrowLeft");
        await expect(dialog.locator("[data-visionneuse-compteur]")).toHaveText(`Photo 1 sur ${n}`);
      }
      // Échap ferme, le focus revient sur la vignette
      await page.keyboard.press("Escape");
      await expect(dialog).not.toHaveAttribute("open", "");
      await expect(vignettes.first()).toBeFocused();
    });
  }

  test.describe("sans JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    for (const url of PAGES_COURSES) {
      test(`${url} : chaque vignette mène à la photo agrandie`, async ({ page, request }) => {
        await page.goto(url);
        for (const href of await page.locator(".galerie__lien").evaluateAll((els) => els.map((e) => e.getAttribute("href")!))) {
          const res = await request.get(href);
          expect(res.status()).toBe(200);
          expect(res.headers()["content-type"]).toContain("image/");
        }
      });
    }
  });
});
