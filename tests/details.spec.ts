import { expect, test, type Page } from "@playwright/test";

/* ======================================================================
   1. /projets : les images à l'écran se révèlent vite (< 1,5 s, donc avant
      la sécurité de 2 s), après chargement, navigation, rechargement
      et retour arrière.
   ====================================================================== */
async function expectOnScreenRevealed(page: Page) {
  const state = () =>
    page.evaluate(() => {
      const onScreen = [...document.querySelectorAll(".card__media")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      });
      const hidden = onScreen.filter((el) => {
        const cs = getComputedStyle(el, "::after");
        if (cs.content === "none" || cs.display === "none") return false;
        return cs.transform === "none" || parseFloat(cs.transform.split(",")[3] ?? "1") > 0.02;
      });
      return { onScreen: onScreen.length, hidden: hidden.length };
    });
  expect((await state()).onScreen).toBeGreaterThan(0);
  await expect.poll(async () => (await state()).hidden, { timeout: 1500, intervals: [100] }).toBe(0);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test.describe(`/projets à ${viewport.width} px : révélation rapide`, () => {
    test.use({ viewport });

    test("chargement direct", async ({ page }) => {
      await page.goto("/projets/");
      await expectOnScreenRevealed(page);
    });

    test("navigation depuis l'accueil", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Projets" }).click();
      await expect(page).toHaveURL(/\/projets\/$/);
      await expectOnScreenRevealed(page);
    });

    test("rechargement en milieu de page", async ({ page }) => {
      await page.goto("/projets/");
      await page.locator(".card__media").last().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.reload();
      await expectOnScreenRevealed(page);
    });

    test("retour arrière depuis un projet", async ({ page }) => {
      await page.goto("/projets/");
      await page.locator(".card__title a").first().click();
      await expect(page).toHaveURL(/\/projets\/homelab\/$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/projets\/$/);
      await expectOnScreenRevealed(page);
    });
  });
}

/* ======================================================================
   2. /parcours : avec des textes accentués et longs, aucun accent ni cédille
      ne touche le texte voisin ; la période est alignée sur le titre.
   ====================================================================== */
const LONG = {
  titre: "Électronicien en équipements à Genève — Été, Ôtage, Ça, Œuvre Éducative",
  periode: "Été 2019 — Août 2022",
  organisation: "Établissement d'Éducation Œcuménique, Ça Ne Bouge Pas",
  groupe: "Équipements et Électricité",
  element: "Éléments À Çà Ô",
};

for (const width of [320, 375, 768, 1440]) {
  test(`/parcours à ${width} px : accents et cédilles ne touchent rien`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/parcours/");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((t) => {
      document.querySelectorAll(".etape__titre").forEach((e) => (e.textContent = t.titre));
      document.querySelectorAll(".etape__periode").forEach((e) => (e.textContent = t.periode));
      document.querySelectorAll(".etape__org").forEach((e) => (e.textContent = t.organisation));
      document.querySelectorAll(".groupe__titre").forEach((e) => (e.textContent = t.groupe));
      document.querySelectorAll(".groupe__liste li").forEach((e) => (e.textContent = t.element));
    }, LONG);

    const problems = await page.evaluate(() => {
      const out: string[] = [];
      const ctx = document.createElement("canvas").getContext("2d")!;

      /** Boîte d'encre réelle (accents, cédilles) d'un élément de texte. */
      const ink = (el: Element) => {
        const cs = getComputedStyle(el);
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const up = cs.textTransform === "uppercase";
        const top = ctx.measureText(up ? "ÉÀÔÈ" : "ÉÀÔÈéàô");
        const bottom = ctx.measureText(up ? "ÇQJ" : "Çgjpqyç");
        const fA = top.fontBoundingBoxAscent;
        const fD = top.fontBoundingBoxDescent;
        const lh = parseFloat(cs.lineHeight);
        const half = (lh - (fA + fD)) / 2;
        const r = el.getBoundingClientRect();
        const lines = Math.max(1, Math.round(r.height / lh));
        const topRel = half + fA - top.actualBoundingBoxAscent;
        const bottomRel = half + fA + bottom.actualBoundingBoxDescent;
        return {
          name: el.className.split(" ")[0],
          lh,
          inkHeight: top.actualBoundingBoxAscent + bottom.actualBoundingBoxDescent,
          top: r.top + topRel,
          bottom: r.top + (lines - 1) * lh + bottomRel,
          firstBaseline: r.top + half + fA,
          lines,
        };
      };
      const below = (upper: { bottom: number; name: string }, lower: { top: number; name: string }) => {
        if (lower.top - upper.bottom < 3) out.push(`${lower.name} touche ${upper.name} (${(lower.top - upper.bottom).toFixed(1)} px)`);
      };

      for (const etape of document.querySelectorAll(".etape")) {
        const box = etape.getBoundingClientRect();
        const periode = ink(etape.querySelector(".etape__periode")!);
        const type = etape.querySelector(".etape__type")!.getBoundingClientRect();
        const titre = ink(etape.querySelector(".etape__titre")!);
        const org = etape.querySelector(".etape__org")!.getBoundingClientRect();

        for (const t of [periode, titre]) {
          // Entre deux lignes d'un même titre
          if (t.lines > 1 && t.lh - t.inkHeight < 2) out.push(`${t.name} : lignes trop serrées (${t.lh.toFixed(1)} < ${t.inkHeight.toFixed(1)} + 2)`);
          // Pas au-dessus du filet de l'étape
          if (t.top < box.top + 2) out.push(`${t.name} dépasse au-dessus de l'étape`);
        }
        below(periode, { top: type.top, name: "etape__type" });
        below(titre, { top: org.top, name: "etape__org" });
        // Téléphone : le titre est sous le libellé
        if (titre.top > type.bottom - 1) below({ bottom: type.bottom, name: "etape__type" }, titre);
        // Ordinateur : période et titre sur la même ligne de base (±2 px)
        if (window.innerWidth >= 768 && Math.abs(periode.firstBaseline - titre.firstBaseline) > 2) {
          out.push(`période et titre non alignés (${(periode.firstBaseline - titre.firstBaseline).toFixed(1)} px)`);
        }
      }

      for (const groupe of document.querySelectorAll(".groupe")) {
        const label = groupe.querySelector(".groupe__titre")!.getBoundingClientRect();
        const item = ink(groupe.querySelector(".groupe__liste li")!);
        below({ bottom: label.bottom, name: "groupe__titre" }, item);
      }
      return out;
    });

    expect(problems).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

/* ======================================================================
   3. Thème sombre : grands numéros, compteurs et périodes en #F2F0EB ;
      #D06F7C réservé aux petits éléments. Thème clair inchangé.
   ====================================================================== */
const BIG = [
  ["/projets/", ".section-count__n"],
  ["/projets/", ".card__num"],
  ["/projets/homelab/", ".projet__num"],
  ["/parcours/", ".etape__periode"],
] as const;

for (const [scheme, expected] of [
  ["dark", "rgb(242, 240, 235)"],
  ["light", "rgb(107, 15, 26)"],
] as const) {
  test(`thème ${scheme} : couleur des grands numéros, compteurs et périodes`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [url, selector] of BIG) {
      await page.goto(url);
      await expect(page.locator(selector).first()).toHaveCSS("color", expected);
    }
    const active = page.getByRole("navigation", { name: "Navigation principale" }).locator("a[aria-current]");
    await expect(active).toHaveCSS("color", scheme === "dark" ? "rgb(208, 111, 124)" : "rgb(107, 15, 26)");
  });
}

/* ======================================================================
   4. « Projet suivant » sur téléphone : jamais un mot seul en dernière ligne.
   ====================================================================== */
for (const width of [320, 375]) {
  test(`« Projet suivant » à ${width} px : pas de mot isolé en dernière ligne`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/projets/homelab/");
    const title = page.locator(".projet__next-title");
    await title.scrollIntoViewIfNeeded();
    const lines = await title.evaluate((el) => {
      const node = el.firstChild!;
      const text = node.textContent!;
      const tops: number[] = [];
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        tops.push(Math.round(range.getBoundingClientRect().top));
      }
      const groups = new Map<number, number>();
      for (const t of tops) groups.set(t, (groups.get(t) ?? 0) + 1);
      return [...groups.values()];
    });
    expect(lines.length).toBeGreaterThan(0);
    // Dernière ligne : au moins deux mots
    expect(lines.at(-1)).toBeGreaterThanOrEqual(2);
    // Interligne légèrement augmenté (≥ 1)
    const ratio = await title.evaluate((el) => {
      const cs = getComputedStyle(el);
      return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    });
    expect(ratio).toBeGreaterThanOrEqual(1);
  });
}
