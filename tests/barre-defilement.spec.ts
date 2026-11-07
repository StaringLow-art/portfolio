import { expect, test } from "@playwright/test";
import { PAGES } from "./helpers";

/**
 * Comme sur Windows : une vraie barre de défilement qui prend de la place
 * (Playwright la masque par défaut). Aucune page ne doit déborder ni couper
 * un élément, de 320 à 2560 px. Numérotation : un seul format, « 01 ».
 */
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

const BARRE = "::-webkit-scrollbar{width:17px;height:17px;background:#ccc}::-webkit-scrollbar-thumb{background:#888}";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((css) => {
    const style = document.createElement("style");
    style.textContent = css;
    document.documentElement.appendChild(style);
  }, BARRE);
});

for (const width of [320, 375, 768, 1024, 1366, 1440, 1920, 2560]) {
  test(`${width} px avec barre de défilement : rien ne déborde ni n'est coupé`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const problemes: string[] = [];
    for (const url of [...PAGES, "/cette-page-n-existe-pas/"]) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      const found = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out: string[] = [];
        // Une page plus haute que l'écran doit bien afficher la barre (sinon le test ne prouve rien)
        if (document.documentElement.scrollHeight > window.innerHeight && window.innerWidth - vw < 10) {
          out.push("barre de défilement absente (test non représentatif)");
        }
        if (document.documentElement.scrollWidth > vw) out.push(`défilement horizontal (${document.documentElement.scrollWidth} > ${vw})`);
        for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const cs = getComputedStyle(el);
          // Mêmes exceptions que le test de débordement de qualite.spec.ts (textes masqués visuellement)
          if (cs.visibility === "hidden" || cs.clip === "rect(0px, 0px, 0px, 0px)" || el.closest(".visually-hidden, .skip-link, [hidden]")) continue;
          const name = `${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith("astro")).join(".")}`;
          if (r.right > vw + 0.5 || r.left < -0.5) out.push(`${name} hors de l'écran (${Math.round(r.left)} → ${Math.round(r.right)})`);
          if ((cs.overflowX === "hidden" || cs.overflowX === "clip") && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains("reveal")) {
            out.push(`${name} coupe son contenu (${el.scrollWidth} > ${el.clientWidth})`);
          }
        }
        return out;
      });
      problemes.push(...found.map((f) => `${url} : ${f}`));
    }
    expect(problemes).toEqual([]);
  });
}

test("numérotation : un seul format « 01 » sur tout le site, aucun « N° »", async ({ page }) => {
  for (const url of [...PAGES, "/cette-page-n-existe-pas/"]) {
    await page.goto(url);
    await expect(page.locator("main"), url).not.toContainText("N°");
    const numeros = await page.locator(".card__num, .projet__num, .univers-card__num, .jeu__num").allTextContents();
    for (const n of numeros) expect(n.trim(), url).toMatch(/^\d{2}$/);
  }
});
