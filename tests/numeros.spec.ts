import { expect, test, type Page } from "@playwright/test";

/**
 * Projets : numéro à gauche du titre, sur la même ligne. Le haut de ses
 * chiffres s'aligne sur le haut des capitales de la 1re ligne du titre ; les
 * lignes suivantes et le résumé commencent sous le début du titre.
 * Mesuré avec les métriques réelles de la police (canvas), indépendamment
 * du calcul CSS.
 */
async function mesurer(page: Page, num: string, titre: string, resume: string) {
  return page.evaluate(
    ([num, titre, resume]) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      /** Haut des capitales du premier caractère d'un élément (px, dans la page). */
      const hautCapitales = (el: Element) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const node = walker.nextNode()!;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, 1);
        const r = range.getClientRects()[0]!;
        const cs = getComputedStyle(node.parentElement!);
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const m = ctx.measureText("H");
        // Boîte du caractère : du haut de la police (ascent) au bas (descent)
        const ascent = m.fontBoundingBoxAscent;
        const hauteur = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
        const baseline = r.top + (r.height - hauteur) / 2 + ascent;
        return { haut: baseline - m.actualBoundingBoxAscent, gauche: r.left, taille: parseFloat(cs.fontSize) };
      };
      return [...document.querySelectorAll(num)].map((n) => {
        const bloc = n.parentElement!;
        const t = bloc.querySelector(titre)!;
        const lignes = [...t.getClientRects()];
        const lignesTitre = (() => {
          const range = document.createRange();
          range.selectNodeContents(t);
          return [...range.getClientRects()].filter((r) => r.width > 1);
        })();
        const hn = hautCapitales(n);
        const ht = hautCapitales(t);
        const r = bloc.querySelector(resume)!.getBoundingClientRect();
        return {
          ecart: Math.abs(hn.haut - ht.haut),
          numPlusPetit: hn.taille < ht.taille,
          numAGauche: n.getBoundingClientRect().right <= ht.gauche,
          lignesAlignees: lignesTitre.every((l) => Math.abs(l.left - ht.gauche) <= 1.5),
          resumeAligne: Math.abs(r.left - ht.gauche) <= 1.5,
          nbLignes: Math.max(lignes.length, new Set(lignesTitre.map((l) => Math.round(l.top))).size),
          debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
    },
    [num, titre, resume] as const,
  );
}

for (const width of [320, 375, 768, 1024, 1440, 1920, 2560]) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("cartes de projets (/pro) : « 01 TITRE » aligné, suite du titre et résumé sous le titre", async ({ page }) => {
      await page.goto("/pro/");
      await page.evaluate(() => document.fonts.ready);
      const cartes = await mesurer(page, ".card__num", ".card__title", ".card__summary");
      expect(cartes).toHaveLength(2);
      for (const c of cartes) {
        expect(c.ecart, "haut du numéro = haut des capitales du titre").toBeLessThanOrEqual(1.5);
        expect(c.numPlusPetit).toBe(true);
        expect(c.numAGauche).toBe(true);
        expect(c.lignesAlignees, "lignes suivantes sous le début du titre").toBe(true);
        expect(c.resumeAligne, "résumé sous le début du titre").toBe(true);
        expect(c.debordement).toBe(0);
      }
      // Le titre PRTG fait plusieurs lignes : le cas est bien testé
      expect(Math.max(...cartes.map((c) => c.nbLignes))).toBeGreaterThan(1);
    });

    test("pages de projets : en-tête « 01 TITRE » aligné, sans débordement", async ({ page }) => {
      for (const url of ["/projets/homelab/", "/projets/projet-cfc/"]) {
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        const [h] = await mesurer(page, ".projet__num", ".projet__title", ".projet__summary");
        expect(h!.ecart, `${url} : haut du numéro = haut des capitales`).toBeLessThanOrEqual(1.5);
        expect(h!.numPlusPetit, url).toBe(true);
        expect(h!.numAGauche, url).toBe(true);
        expect(h!.lignesAlignees, `${url} : lignes sous le début du titre`).toBe(true);
        expect(h!.resumeAligne, `${url} : résumé sous le début du titre`).toBe(true);
        expect(h!.debordement, url).toBe(0);
      }
    });

    test("/pro : « PROFESSIONNEL » sur une ligne, entier, sans recouvrir les informations", async ({ page }) => {
      await page.goto("/pro/");
      await page.evaluate(() => document.fonts.ready);
      const g = await page.evaluate(() => {
        const h1 = document.querySelector(".pro__title")!;
        const range = document.createRange();
        range.selectNodeContents(h1);
        const lignes = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        const texte = range.getBoundingClientRect();
        const tete = document.querySelector(".pro__head")!;
        const cs = getComputedStyle(tete);
        const contenuDroite = tete.getBoundingClientRect().right - parseFloat(cs.paddingRight);
        const intro = document.querySelector(".pro__intro")!.getBoundingClientRect();
        return { lignes, droite: texte.right, contenuDroite, bas: h1.getBoundingClientRect().bottom, introHaut: intro.top, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(g.lignes, "une seule ligne").toBe(1);
      expect(g.droite, "le mot tient dans la largeur").toBeLessThanOrEqual(g.contenuDroite + 0.5);
      expect(g.introHaut, "informations sous le titre").toBeGreaterThanOrEqual(g.bas - 1);
      expect(g.scroll).toBe(0);
    });
  });
}
