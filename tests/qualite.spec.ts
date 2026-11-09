import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PAGES, SITE_ORIGIN, watchPage } from "./helpers";

const SITE = "https://portfolio.cardamone-online.ch";
/** Pages publiques (Sport et ses courses inclus dès qu'ils sont publiés). */
const PUBLIC_PAGES = PAGES;
const NOT_FOUND = "/cette-page-n-existe-pas/";
const ALL_PAGES = [...PUBLIC_PAGES, NOT_FOUND];

/* ======================================================================
   Accessibilité : axe, clair et sombre, toutes les pages
   ====================================================================== */
for (const scheme of ["light", "dark"] as const) {
  test(`axe (${scheme}) : aucune violation sérieuse ou critique`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const serious: string[] = [];
    const others: string[] = [];
    for (const url of ALL_PAGES) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      // Faire défiler pour révéler les images (état final, celui que lit l'utilisateur)
      await scrollThrough(page);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      for (const v of result.violations) {
        const line = `${url} [${v.impact}] ${v.id} : ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`;
        (v.impact === "serious" || v.impact === "critical" ? serious : others).push(line);
      }
    }
    if (others.length) test.info().annotations.push({ type: "axe (mineur/modéré)", description: others.join("\n") });
    expect(serious).toEqual([]);
    expect(others).toEqual([]);
  });
}

async function scrollThrough(page: Page) {
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= h; y += 400) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
}

/* ======================================================================
   Clavier : lien d'évitement, tous les éléments atteignables, focus visible
   ====================================================================== */
for (const url of ALL_PAGES) {
  test(`clavier ${url} : évitement, ordre complet, focus visible`, async ({ page }) => {
    await page.goto(url);
    // 1. Premier Tab : lien d'évitement, visible
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    // 2. Entrée : le focus passe au contenu principal
    await page.keyboard.press("Enter");
    await expect(page.locator("main#contenu")).toBeFocused();

    // 3. Depuis le début : Tab atteint chaque élément interactif visible
    await page.goto(url);
    const expected = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("a[href], button:not([hidden])")]
        .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed")
        .filter((el) => !el.closest("[hidden]"))
        .map((el, i) => {
          el.dataset.kbd = String(i);
          return i;
        }).length,
    );
    const reached = new Set<string>();
    const invisibleFocus: string[] = [];
    for (let i = 0; i < expected + 3; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const visible = el.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2;
        return { id: el.dataset.kbd ?? null, label: (el.textContent ?? "").trim().slice(0, 30), visible };
      });
      if (!info) continue;
      if (info.id !== null) reached.add(info.id);
      if (!info.visible) invisibleFocus.push(info.label);
    }
    expect(reached.size, "éléments atteints au clavier").toBe(expected);
    expect(invisibleFocus, "focus invisible sur").toEqual([]);
  });
}

/* ======================================================================
   Thème : aucun flash, stockage indisponible
   ====================================================================== */
for (const [stored, system] of [
  ["dark", "light"],
  ["light", "dark"],
] as const) {
  test(`thème : choix « ${stored} » appliqué avant l'affichage (système ${system})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: system });
    await page.goto("/");
    await page.evaluate((t) => localStorage.setItem("theme", t), stored);
    // Relève l'état du thème au moment exact où <body> apparaît (avant tout affichage)
    await page.addInitScript(() => {
      const w = window as unknown as { __atBody?: { theme?: string; bg: string } };
      new MutationObserver((_, obs) => {
        if (document.body) {
          w.__atBody = {
            theme: document.documentElement.dataset.theme,
            bg: getComputedStyle(document.documentElement).getPropertyValue("--c-bg").trim(),
          };
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    const atBody = await page.evaluate(() => (window as unknown as { __atBody?: { theme?: string; bg: string } }).__atBody);
    expect(atBody?.theme).toBe(stored);
    expect(atBody?.bg.toLowerCase()).toBe(stored === "dark" ? "#111110" : "#f2f0eb");
  });
}

test("thème : localStorage bloqué → aucune erreur, le bouton fonctionne", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("stockage bloqué");
      },
    });
  });
  const watched = watchPage(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(watched.consoleErrors).toEqual([]);
});

/* ======================================================================
   Sans JavaScript : toutes les pages lisibles, CV accessible
   ====================================================================== */
test.describe("sans JavaScript, toutes les pages", () => {
  test.use({ javaScriptEnabled: false });

  for (const url of ALL_PAGES) {
    test(`${url} lisible`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("h1")).toHaveCSS("opacity", "1");
      await expect(page.locator("[data-theme-toggle]")).toBeHidden();
      // Aucun cache sur les images
      const covered = await page.evaluate(() =>
        [...document.querySelectorAll(".reveal")].filter((el) => getComputedStyle(el, "::after").content !== "none").length,
      );
      expect(covered).toBe(0);
      // Images visibles
      for (const img of await page.locator("main img").all()) await expect(img).toBeVisible();
    });
  }

  for (const url of ["/pro/", "/contact/", NOT_FOUND]) {
    test(`${url} : CV accessible`, async ({ page, request }) => {
      await page.goto(url);
      const link = page.locator('a[href="/Ryan-Cardamone-CV.pdf"]').first();
      await expect(link).toBeVisible();
      const res = await request.get("/Ryan-Cardamone-CV.pdf");
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("pdf");
    });
  }
});

/* ======================================================================
   Mouvement réduit : aucune animation, aucune transition entre pages
   ====================================================================== */
test.describe("prefers-reduced-motion: reduce", () => {
  test.use({ reducedMotion: "reduce" });

  for (const url of ALL_PAGES) {
    test(`${url} : aucune animation en cours`, async ({ page }) => {
      await page.goto(url);
      // Aucun délai de départ : avec ce réglage, rien n'attend avant de s'afficher.
      // Ce contrôle ne dépend pas de la vitesse de l'ordinateur (contrairement au
      // suivant, qui n'avait échoué que sur le serveur plus lent de GitHub Actions).
      const delayed = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => Number(a.effect?.getComputedTiming().delay ?? 0) > 0)
          .map((a) => `${(a as CSSAnimation).animationName ?? "?"} (${a.effect!.getComputedTiming().delay} ms)`),
      );
      expect(delayed, "animations avec un délai de départ").toEqual([]);
      await page.waitForTimeout(150);
      const running = await page.evaluate(() =>
        document.getAnimations().filter((a) => a.playState === "running").map((a) => (a as CSSAnimation).animationName ?? "?"),
      );
      expect(running).toEqual([]);
      await expect(page.locator("html")).not.toHaveClass(/reveal-pending/);
    });
  }
});

for (const motion of ["no-preference", "reduce"] as const) {
  test(`transition entre pages (${motion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion });
    await page.addInitScript(() => {
      window.addEventListener("pagereveal", (e) => {
        (window as unknown as { __vt?: boolean }).__vt = !!(e as Event & { viewTransition?: unknown }).viewTransition;
      });
    });
    await page.goto("/");
    await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Pro" }).click();
    await expect(page).toHaveURL(/\/pro\/$/);
    const vt = await page.evaluate(() => (window as unknown as { __vt?: boolean }).__vt);
    expect(vt).toBe(motion === "no-preference");
  });
}

/* ======================================================================
   Aucun élément coupé ni débordement, aux largeurs du prompt
   ====================================================================== */
for (const width of [320, 375, 768, 1024, 1440, 1920]) {
  test(`${width} px : aucun débordement ni élément coupé`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const problems: string[] = [];
    for (const url of ALL_PAGES) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      const found = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out: string[] = [];
        if (document.documentElement.scrollWidth > vw) out.push(`défilement horizontal (${document.documentElement.scrollWidth} > ${vw})`);
        for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.clip === "rect(0px, 0px, 0px, 0px)" || el.closest(".visually-hidden, .skip-link, [hidden]")) continue;
          const name = `${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith("astro")).join(".")}`;
          if (r.right > vw + 0.5 || r.left < -0.5) out.push(`${name} hors de l'écran (${Math.round(r.left)} → ${Math.round(r.right)})`);
          // Contenu coupé par un conteneur qui masque son débordement
          if ((cs.overflowX === "hidden" || cs.overflowX === "clip") && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains("reveal")) {
            out.push(`${name} coupe son contenu (${el.scrollWidth} > ${el.clientWidth})`);
          }
        }
        return out;
      });
      problems.push(...found.map((f) => `${url} : ${f}`));
    }
    expect(problems).toEqual([]);
  });
}

/* ======================================================================
   Référencement et partage
   ====================================================================== */
test("titres, descriptions, canonique et Open Graph", async ({ page, request }) => {
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  for (const url of PUBLIC_PAGES) {
    await page.goto(url);
    const meta = await page.evaluate(() => {
      const get = (sel: string, attr = "content") => document.querySelector(sel)?.getAttribute(attr) ?? null;
      return {
        title: document.title,
        description: get('meta[name="description"]'),
        canonical: get('link[rel="canonical"]', "href"),
        ogTitle: get('meta[property="og:title"]'),
        ogDescription: get('meta[property="og:description"]'),
        ogUrl: get('meta[property="og:url"]'),
        ogImage: get('meta[property="og:image"]'),
        ogW: get('meta[property="og:image:width"]'),
        ogH: get('meta[property="og:image:height"]'),
        twitter: get('meta[name="twitter:card"]'),
        icon: get('link[rel="icon"]', "href"),
        robots: get('meta[name="robots"]'),
      };
    });
    expect(meta.title.length, url).toBeGreaterThan(5);
    expect(meta.description?.length ?? 0, url).toBeGreaterThan(30);
    expect(titles.has(meta.title), `titre en double : ${meta.title}`).toBe(false);
    expect(descriptions.has(meta.description!), `description en double : ${meta.description}`).toBe(false);
    titles.set(meta.title, url);
    descriptions.set(meta.description!, url);
    expect(meta.canonical).toBe(`${SITE}${url}`);
    expect(meta.ogUrl).toBe(`${SITE}${url}`);
    expect(meta.ogTitle).toBe(meta.title);
    expect(meta.ogDescription).toBe(meta.description);
    expect(meta.ogImage).toBe(`${SITE}/og-image.png`);
    expect([meta.ogW, meta.ogH]).toEqual(["1200", "630"]);
    expect(meta.twitter).toBe("summary_large_image");
    expect(meta.robots, `${url} ne doit pas être exclue de l'indexation`).toBeNull();
    expect((await request.get(meta.icon!)).status()).toBe(200);
  }
  // L'image de partage existe et mesure 1200 × 630
  await page.goto("/");
  const size = await page.evaluate(async () => {
    const img = new Image();
    img.src = "/og-image.png";
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  });
  expect(size).toEqual([1200, 630]);
});

test("données structurées Person minimales, sans adresse ni téléphone", async ({ page }) => {
  await page.goto("/");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks).toHaveLength(1);
  const data = JSON.parse(blocks[0]!);
  expect(data["@context"]).toBe("https://schema.org");
  expect(data["@type"]).toBe("Person");
  expect(data.name).toBe("Ryan Cardamone");
  expect(data.url).toBe(`${SITE}/`);
  const keys = JSON.stringify(data).toLowerCase();
  for (const forbidden of ["address", "telephone", "birthdate", "streetaddress", "postalcode"]) {
    expect(keys, forbidden).not.toContain(forbidden);
  }
});

test("robots.txt et sitemap", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/User-agent: \*/);
  expect(robots).toMatch(/Allow: \//);
  expect(robots).not.toMatch(/Disallow: \/\s*$/m);
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);

  const index = await (await request.get("/sitemap-index.xml")).text();
  expect(index).toContain(`${SITE}/sitemap-0.xml`);
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  expect(locs).toEqual(PUBLIC_PAGES.map((p) => `${SITE}${p}`).sort());
});

test("404 : aucune erreur console ni requête externe", async ({ page }) => {
  const watched = watchPage(page);
  await page.goto(NOT_FOUND);
  await page.waitForLoadState("networkidle");
  // Le seul « échec » attendu est le statut 404 de la page elle-même
  expect(watched.consoleErrors.filter((e) => !/404/.test(e))).toEqual([]);
  expect(watched.externalRequests).toEqual([]);
  expect(SITE_ORIGIN).toContain("localhost");
});
