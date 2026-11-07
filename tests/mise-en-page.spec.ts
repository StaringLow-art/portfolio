import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [320, 375, 768, 1024, 1440, 1920, 2560];
const heightFor = (w: number) => (w < 768 ? 812 : w >= 2560 ? 1440 : 900);

const TITLES: Array<[string, string]> = [
  ["/pro/", ".card__title"],
  ["/", ".univers-card__title"],
  ["/jeux/", ".jeu__titre"],
  ["/pro/", ".pro__title"],
  ["/pro/", ".section-title"],
  ["/projets/projet-cfc/", ".projet__title"],
  ["/projets/projet-cfc/", ".projet__next-title"],
  ["/projets/homelab/", ".projet__next-title"],
  ["/projets/projet-cfc/", ".prose h2"],
  ["/cette-page-n-existe-pas/", ".erreur__title"],
];

/**
 * Pour chaque titre : lignes réelles (mots regroupés par ligne), mot isolé en
 * dernière ligne, et distance réelle entre l'encre de deux lignes successives
 * (mesurée avec la police chargée : accents au-dessus, jambages en dessous).
 */
async function analyse(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    return els.map((el) => {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const fD = ctx.measureText("H").fontBoundingBoxDescent;
      const up = (s: string) => (cs.textTransform === "uppercase" ? s.toUpperCase() : s);

      // Mots et leur ligne
      const words: { text: string; top: number; bottom: number }[] = [];
      let brokenWords = 0;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const m of node.textContent!.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, m.index!);
          range.setEnd(node, m.index! + m[0].length);
          const r = range.getBoundingClientRect();
          // Un mot coupé sur deux lignes occupe plusieurs rectangles
          if (range.getClientRects().length > 1) brokenWords++;
          words.push({ text: m[0], top: Math.round(r.top), bottom: r.bottom });
        }
      }
      const lines: { text: string; baseline: number }[] = [];
      for (const w of words) {
        const last = lines.at(-1);
        if (last && Math.abs((last as unknown as { top: number }).top - w.top) <= 2) last.text += ` ${w.text}`;
        else lines.push(Object.assign({ text: w.text, baseline: w.bottom - fD }, { top: w.top }));
      }
      // Distance d'encre entre lignes successives
      const gaps: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const above = ctx.measureText(up(lines[i - 1]!.text));
        const below = ctx.measureText(up(lines[i]!.text));
        const inkBottomAbove = lines[i - 1]!.baseline + above.actualBoundingBoxDescent;
        const inkTopBelow = lines[i]!.baseline - below.actualBoundingBoxAscent;
        gaps.push(inkTopBelow - inkBottomAbove);
      }
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent!.trim(),
        lines: lines.map((l) => l.text),
        lastLineWords: lines.at(-1)?.text.split(" ").length ?? 0,
        wordCount: words.length,
        minGap: gaps.length ? Math.min(...gaps) : null,
        brokenWords,
        hyphens: cs.hyphens,
        overflowRight: r.right - document.documentElement.clientWidth,
      };
    });
  });
}

for (const width of WIDTHS) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: heightFor(width) } });

    test("titres : pas de mot isolé, lettres qui ne se touchent jamais", async ({ page }) => {
      const problems: string[] = [];
      for (const accented of [false, true]) {
        for (const [url, selector] of TITLES) {
          await page.goto(url);
          await page.evaluate(() => document.fonts.ready);
          if (accented) {
            // Variante accentuée : É et À en majuscules dans chaque titre
            await page.locator(selector).evaluateAll((els) =>
              els.forEach((el) => {
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                for (let n = walker.nextNode(); n; n = walker.nextNode()) n.textContent = n.textContent!.replace(/e/gi, "É").replace(/a/gi, "À");
              }),
            );
          }
          for (const t of await analyse(page, selector)) {
            const where = `${url} ${selector} « ${t.text} »${accented ? " (accentué)" : ""} → ${JSON.stringify(t.lines)}`;
            if (t.wordCount >= 3 && t.lines.length >= 2 && t.lastLineWords < 2) problems.push(`mot isolé : ${where}`);
            if (t.minGap !== null && t.minGap < 2) problems.push(`lettres trop proches (${t.minGap.toFixed(1)} px) : ${where}`);
            if (t.overflowRight > 0.5) problems.push(`déborde à droite : ${where}`);
            if (t.brokenWords > 0) problems.push(`mot coupé sur deux lignes : ${where}`);
            if (t.hyphens === "auto") problems.push(`césure automatique active : ${where}`);
          }
        }
      }
      expect(problems).toEqual([]);
    });

    test("marges : logo, texte du héros et titre UNIVERS alignés à gauche ; portrait et menu à droite", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const a = await page.evaluate(() => {
        const left = (s: string) => document.querySelector(s)!.getBoundingClientRect().left;
        const right = (s: string) => document.querySelector(s)!.getBoundingClientRect().right;
        // Bord gauche du texte (premier caractère), pas de la boîte
        const textLeft = (s: string) => {
          const el = document.querySelector(s)!;
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getClientRects()[0]!.left;
        };
        return {
          logo: textLeft(".logo"),
          kicker: textLeft(".hero__kicker"),
          role: textLeft(".hero__role"),
          univers: left(".section-title"),
          headerRight: right(".site-header .theme-toggle"),
          photoRight: right(".hero__figure"),
          sectionHeadRight: right(".section-head"),
        };
      });
      for (const [name, value] of Object.entries({ kicker: a.kicker, role: a.role, univers: a.univers })) {
        // Tolérance : approche latérale des glyphes d'Anton / d'Instrument Sans
        expect(Math.abs(value - a.logo), `${name} aligné sur le logo`).toBeLessThanOrEqual(4);
      }
      if (width >= 768) {
        expect(Math.abs(a.photoRight - a.headerRight), "portrait aligné sur le bord droit du menu").toBeLessThanOrEqual(1.5);
        expect(Math.abs(a.sectionHeadRight - a.headerRight), "sections alignées sur le menu").toBeLessThanOrEqual(1.5);
      }
    });

    test("mosaïque : repères de coupe autour de chaque image, sans débordement", async ({ page }) => {
      for (const url of ["/pro/", "/", "/jeux/"]) {
        await page.goto(url);
        const r = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          return {
            overflow: document.documentElement.scrollWidth - vw,
            frames: [...document.querySelectorAll(".card__frame, .univers-card__frame, .jeu__frame")].map((f) => {
              const rect = f.getBoundingClientRect();
              return ["::before", "::after"].map((p) => {
                const cs = getComputedStyle(f, p);
                return {
                  shown: cs.display !== "none" && cs.content !== "none" && cs.backgroundImage !== "none",
                  // Bord droit du repère, dans la page
                  right: rect.right - parseFloat(cs.right),
                  left: rect.left - parseFloat(cs.left),
                  vw,
                };
              });
            }),
          };
        });
        expect(r.overflow, `${url} : défilement horizontal`).toBe(0);
        r.frames.flat().forEach((m, i) => {
          expect(m.shown, `${url} : repères de l'image ${Math.floor(i / 2) + 1}`).toBe(true);
          expect(m.right, `${url} : repère hors écran à droite`).toBeLessThanOrEqual(m.vw + 0.5);
          expect(m.left, `${url} : repère hors écran à gauche`).toBeGreaterThanOrEqual(-0.5);
        });
      }
    });

    test("largeur de lecture : aucune ligne de texte au-delà de 75 caractères", async ({ page }) => {
      const tooWide: string[] = [];
      for (const url of ["/", "/pro/", "/jeux/", "/projets/projet-cfc/", "/projets/homelab/", "/contact/", "/cette-page-n-existe-pas/"]) {
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        const found = await page.locator("main p, main li").evaluateAll((els) => {
          const ctx = document.createElement("canvas").getContext("2d")!;
          const out: string[] = [];
          for (const el of els) {
            // Chaque nœud de texte, mesuré ligne par ligne avec la police de son parent
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (!node.textContent!.trim()) continue;
              const cs = getComputedStyle(node.parentElement!);
              ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
              const ch = ctx.measureText("0").width;
              const range = document.createRange();
              range.selectNodeContents(node);
              const longest = Math.max(0, ...[...range.getClientRects()].map((r) => r.width));
              if (longest / ch > 75) out.push(`« ${node.textContent!.trim().slice(0, 40)}… » ${Math.round(longest / ch)} car.`);
            }
          }
          return out;
        });
        tooWide.push(...found.map((f) => `${url} ${f}`));
      }
      expect(tooWide).toEqual([]);
    });

    test("technologies et compétences : aucun séparateur « / »", async ({ page }) => {
      for (const [url, selector] of [
        ["/projets/projet-cfc/", ".projet__tech li"],
        ["/pro/", ".groupe__liste li"],
      ] as const) {
        await page.goto(url);
        const seps = await page.locator(selector).evaluateAll((els) =>
          els.filter((el) => {
            const after = getComputedStyle(el, "::after").content;
            const before = getComputedStyle(el, "::before").content;
            return /\//.test(after) || /\//.test(before) || el.textContent!.trim() === "/";
          }).length,
        );
        expect(seps, `${url} ${selector}`).toBe(0);
      }
    });

    test("capture PRTG : entière dans la vignette, lien vers la taille réelle", async ({ page, request }) => {
      await page.goto("/pro/");
      const card = page.locator(".card").filter({ hasText: "PRTG" }).locator(".card__media");
      const ratio = await card.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const img = el.querySelector("img")!;
        return { box: r.width / r.height, natural: Number(img.getAttribute("width")) / Number(img.getAttribute("height")) };
      });
      expect(Math.abs(ratio.box / ratio.natural - 1)).toBeLessThan(0.01);
      await page.goto("/projets/projet-cfc/");
      const zoom = page.getByRole("link", { name: "Voir l'image en taille réelle" });
      await expect(zoom).toBeVisible();
      const res = await request.get((await zoom.getAttribute("href"))!);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/");
    });

    test("Parcours : aucune ligne de période ne commence par un tiret", async ({ page }) => {
      await page.goto("/pro/");
      await page.evaluate(() => document.fonts.ready);
      const bad = await page.locator(".etape__periode").evaluateAll((els) =>
        els.flatMap((el) => {
          const node = el.firstChild!;
          const tokens = [...node.textContent!.matchAll(/\S+/g)].map((m) => {
            const range = document.createRange();
            range.setStart(node, m.index!);
            range.setEnd(node, m.index! + m[0].length);
            return { text: m[0], top: Math.round(range.getBoundingClientRect().top) };
          });
          return tokens
            .filter((t, i) => /^[-–—]$/.test(t.text) && (i === 0 || tokens[i - 1]!.top !== t.top))
            .map(() => el.textContent!);
        }),
      );
      expect(bad).toEqual([]);
      // Tiret demi-cadratin uniquement
      for (const text of await page.locator(".etape__periode").allTextContents()) {
        expect(text).toContain("–");
        expect(text).not.toMatch(/[—]|\s-\s/);
      }
    });

    test("page projet : image entière dans la fenêtre, alignée à gauche, sans déformation", async ({ page }) => {
      await page.goto("/projets/projet-cfc/");
      const img = page.locator(".projet__cover img");
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
      const g = await page.evaluate(() => {
        const i = document.querySelector<HTMLImageElement>(".projet__cover img")!;
        const r = i.getBoundingClientRect();
        // Bord gauche du contenu de l'en-tête : le numéro, à gauche du titre
        const title = document.querySelector(".projet__num")!.getBoundingClientRect();
        const column = document.querySelector(".projet__head")!;
        const cs = getComputedStyle(column);
        const c = column.getBoundingClientRect();
        return {
          left: r.left,
          contentLeft: title.left,
          right: r.right,
          contentRight: c.right - parseFloat(cs.paddingRight),
          height: r.height,
          viewport: window.innerHeight,
          renderedRatio: r.width / r.height,
          naturalRatio: i.naturalWidth / i.naturalHeight,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          navLeft: document.querySelector(".projet__nav")!.getBoundingClientRect().left,
          navRight: document.querySelector(".projet__nav")!.getBoundingClientRect().right,
        };
      });
      // Sections Contexte / Ce que j'ai réalisé / Résultat alignées sur l'image,
      // colonne de lecture confortable (≤ 70 caractères de large)
      const prose = await page.evaluate(() => {
        const headings = [...document.querySelectorAll(".prose h2")].map((h) => h.getBoundingClientRect().left);
        const p = document.querySelector(".prose p")!;
        const cs = getComputedStyle(p);
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const ch = ctx.measureText("0").width;
        const prosebox = document.querySelector(".prose")!.getBoundingClientRect();
        return { headings, proseLeft: prosebox.left, chars: prosebox.width / ch };
      });
      expect(prose.headings.length).toBe(3);
      for (const left of [...prose.headings, prose.proseLeft]) {
        expect(Math.abs(left - g.left), "texte aligné sur le bord gauche de l'image").toBeLessThanOrEqual(1.5);
      }
      expect(prose.chars, "largeur de lecture confortable").toBeLessThanOrEqual(70);
      expect(Math.abs(g.navLeft - g.contentLeft), "filet de navigation aligné à gauche").toBeLessThanOrEqual(1.5);
      expect(Math.abs(g.navRight - g.contentRight), "filet de navigation aligné à droite").toBeLessThanOrEqual(1.5);
      expect(Math.abs(g.left - g.contentLeft), "bord gauche aligné sur le contenu").toBeLessThanOrEqual(1.5);
      expect(g.right, "ne dépasse pas la colonne de contenu").toBeLessThanOrEqual(g.contentRight + 1);
      expect(g.height, "visible en entier dans la fenêtre").toBeLessThanOrEqual(g.viewport * 0.8);
      expect(Math.abs(g.renderedRatio / g.naturalRatio - 1), "proportions conservées").toBeLessThan(0.01);
      // Jamais affichée plus large que sa taille native (sinon floue)
      const native = await img.evaluate((i: HTMLImageElement) => Number(i.getAttribute("width")));
      const shown = await img.evaluate((i: HTMLImageElement) => i.getBoundingClientRect().width);
      expect(shown, "image pas agrandie au-delà de sa taille native").toBeLessThanOrEqual(native + 0.5);
      expect(g.overflow).toBe(0);
    });
  });
}
