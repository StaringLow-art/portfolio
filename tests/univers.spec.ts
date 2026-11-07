import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { ANCIENNES_ADRESSES, SITE_ORIGIN, watchPage } from "./helpers";

const NAV = { name: "Navigation principale" } as const;
const FAVORIS = [
  "The Legend of Zelda: Breath of the Wild",
  "The Legend of Zelda: Tears of the Kingdom",
  "Project Zomboid",
  "Grand Theft Auto V Online",
  "Rainbow Six Siege",
  "Aniimo",
];

/* ======================================================================
   Menu : Accueil, Pro, Jeux, Contact ; page active sur chaque page
   ====================================================================== */
test.describe("menu", () => {
  test("ordre exact et page active", async ({ page }) => {
    const attendu = [
      ["/", "Accueil", "page"],
      ["/pro/", "Pro", "page"],
      ["/jeux/", "Jeux", "page"],
      ["/contact/", "Contact", "page"],
      ["/projets/homelab/", "Pro", "true"], // une page de projet appartient à Pro
    ] as const;
    for (const [url, actif, valeur] of attendu) {
      await page.goto(url);
      const nav = page.getByRole("navigation", NAV);
      await expect(nav.getByRole("link")).toHaveText(["Accueil", "Pro", "Jeux", "Contact"]);
      await expect(nav.locator("a[aria-current]"), url).toHaveCount(1);
      await expect(nav.getByRole("link", { name: actif }), url).toHaveAttribute("aria-current", valeur);
    }
  });
});

/* ======================================================================
   Anciennes adresses : redirection propre vers la section de /pro/
   ====================================================================== */
test.describe("anciennes adresses", () => {
  for (const { from, to, section } of ANCIENNES_ADRESSES) {
    test(`${from} → ${to} (redirection, non indexée, hors sitemap)`, async ({ page, request }) => {
      const res = await request.get(from);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<meta http-equiv="refresh" content="0;url=${to}">`);
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html).toContain('<link rel="canonical" href="https://portfolio.cardamone-online.ch/pro/">');
      // Lien visible si la redirection automatique ne se fait pas
      expect(html).toContain(`href="${to}"`);

      await page.goto(from);
      await expect(page).toHaveURL(new RegExp(`/pro/${section}$`));
      await expect(page.locator(section)).toBeInViewport();

      const sitemap = await (await request.get("/sitemap-0.xml")).text();
      expect(sitemap).not.toContain(`<loc>https://portfolio.cardamone-online.ch${from}</loc>`);
    });
  }

  test.describe("sans JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    for (const { from, section } of ANCIENNES_ADRESSES) {
      test(`${from} redirige aussi sans JavaScript`, async ({ page }) => {
        await page.goto(from);
        await expect(page).toHaveURL(new RegExp(`/pro/${section}$`));
      });
    }
  });

  test("les pages de projets gardent leur adresse", async ({ request }) => {
    for (const url of ["/projets/homelab/", "/projets/projet-cfc/"]) {
      expect((await request.get(url)).status(), url).toBe(200);
    }
  });
});

/* ======================================================================
   Accueil : présentation, univers à égalité, plus d'infos pro
   ====================================================================== */
test.describe("accueil", () => {
  test("présentation, univers Pro et Jeux à égalité, sans infos professionnelles", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero__role")).toHaveText(
      "Informaticien, pilote, gamer et passionné de musique. Bienvenue dans mon univers.",
    );
    // Retirés de l'accueil : région, disponibilité, CV, aperçu des projets
    const main = page.locator("main");
    await expect(main.getByText("Région")).toHaveCount(0);
    await expect(main.getByText(/Disponible dès/)).toHaveCount(0);
    await expect(main.locator('a[href$=".pdf"]')).toHaveCount(0);
    await expect(main.locator(".card")).toHaveCount(0);

    // Deux univers, mêmes dimensions
    const cartes = page.locator(".univers-card");
    await expect(cartes).toHaveCount(2);
    await expect(page.locator(".univers-card__title a")).toHaveText(["Professionnel", "Jeux"]);
    await expect(page.locator(".univers-card__title a").first()).toHaveAttribute("href", "/pro/");
    await expect(page.locator(".univers-card__title a").last()).toHaveAttribute("href", "/jeux/");
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const tailles = await page.locator(".univers-card__visuel").evaluateAll((els) =>
        els.map((el) => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)]),
      );
      expect(tailles[0], `${width} px : univers à égalité`).toEqual(tailles[1]);
    }
  });

  for (const scheme of ["light", "dark"] as const)
  for (const width of [320, 360, 375, 414, 768, 1024, 1280, 1440, 1920, 2560]) {
    test(`${width} px, thème ${scheme} : aucun débordement (« 02 UNIVERS », cartes Professionnel et Jeux)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const r = (el: Element) => el.getBoundingClientRect();
        const titre = r(document.querySelector(".home-univers .section-title")!);
        const compteur = r(document.querySelector(".home-univers .section-count")!);
        const cartes = [...document.querySelectorAll(".univers-card")].map((c) => {
          const visuel = c.querySelector(".univers-card__visuel")!;
          const mot = r(c.querySelector(".univers-card__mot")!);
          return { carte: r(c), visuel: r(visuel), mot, coupe: visuel.scrollWidth > visuel.clientWidth + 1 };
        });
        return { vw, scroll: document.documentElement.scrollWidth - vw, titre, compteur, cartes };
      });
      expect(m.scroll, "défilement horizontal").toBe(0);
      expect(m.compteur.right, "« 02 UNIVERS » dans l'écran").toBeLessThanOrEqual(m.vw);
      expect(m.titre.right, "« UNIVERS » ne touche pas le compteur").toBeLessThanOrEqual(m.compteur.left);
      for (const [i, c] of m.cartes.entries()) {
        expect(c.carte.right, `carte ${i + 1} dans l'écran`).toBeLessThanOrEqual(m.vw);
        expect(c.carte.left, `carte ${i + 1} dans l'écran`).toBeGreaterThanOrEqual(0);
        expect(c.mot.right, `mot de la carte ${i + 1} entier`).toBeLessThanOrEqual(c.visuel.right);
        expect(c.coupe, `carte ${i + 1} : contenu coupé`).toBe(false);
      }
      // Ordinateur : cartes un tiers moins hautes (2:1) ; téléphone : 4:3
      const ratio = m.cartes[0]!.visuel.height / m.cartes[0]!.visuel.width;
      expect(Math.abs(ratio - (width >= 768 ? 0.5 : 0.75))).toBeLessThan(0.02);
    });
  }

  test("aucun lien « PRO · JEUX » sous le nom : le menu suffit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero a")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Univers" })).toHaveCount(0);
  });

  test("cartes Univers : sans numéro, titre en bas à gauche, description seule dessous", async ({ page }) => {
    await page.goto("/");
    // Aucun numéro dans les cartes ; le compteur « 02 UNIVERS » reste
    await expect(page.locator(".univers-card__num")).toHaveCount(0);
    for (const n of ["01", "02"]) await expect(page.locator(".univers-card").getByText(n, { exact: true })).toHaveCount(0);
    await expect(page.locator(".univers-card__visuel .univers-card__title")).toHaveText(["Professionnel", "Jeux"]);
    await expect(page.locator(".home-univers .section-count")).toHaveText(/02\s*univers/i);
    // Sous la carte : seulement la description (ni numéro, ni titre répétés)
    const dessous = await page.locator(".univers-card").evaluateAll((cartes) =>
      cartes.map((c) => [...c.children].filter((e) => !e.classList.contains("univers-card__frame")).map((e) => e.className.split(" ")[0])),
    );
    expect(dessous).toEqual([["univers-card__resume"], ["univers-card__resume"]]);
    // Le filet sous la description fait toute la largeur de la carte
    const filets = await page.locator(".univers-card").evaluateAll((cartes) =>
      cartes.map((c) => {
        const carte = c.querySelector(".univers-card__visuel")!.getBoundingClientRect();
        const filet = c.querySelector(".univers-card__resume")!.getBoundingClientRect();
        return Math.abs(carte.width - filet.width) < 1 && Math.abs(carte.left - filet.left) < 1;
      }),
    );
    expect(filets).toEqual([true, true]);
    for (const titre of ["Professionnel", "Jeux"]) await expect(page.locator(".home-univers").getByText(titre, { exact: true })).toHaveCount(1);
    // Titre en bas à gauche, exactement dans la marge intérieure ; même taille
    // pour les deux, la plus grande possible pour que « PROFESSIONNEL » tienne
    for (const width of [320, 375, 768, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      const g = await page.locator(".univers-card__visuel").evaluateAll((els) =>
        els.map((v) => {
          const b = v.getBoundingClientRect();
          const cs = getComputedStyle(v);
          const mot = v.querySelector(".univers-card__mot")!;
          const t = mot.getBoundingClientRect();
          return {
            gauche: Math.abs(t.left - b.left - parseFloat(cs.paddingLeft)),
            bas: Math.abs(b.bottom - parseFloat(cs.paddingBottom) - t.bottom),
            taille: parseFloat(getComputedStyle(mot).fontSize),
            remplissage: t.width / (b.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
          };
        }),
      );
      for (const c of g) {
        expect(c.gauche, `${width} px : titre sur la marge gauche`).toBeLessThanOrEqual(1);
        expect(c.bas, `${width} px : titre sur la marge du bas`).toBeLessThanOrEqual(1);
      }
      expect(g[0]!.taille, `${width} px : même taille de titre`).toBe(g[1]!.taille);
      expect(g[0]!.remplissage, `${width} px : « PROFESSIONNEL » tient`).toBeLessThanOrEqual(1);
      expect(g[0]!.remplissage, `${width} px : taille la plus grande possible`).toBeGreaterThan(0.95);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    // Toute la pochette mène à l'univers (coins compris) ; la carte doit être
    // à l'écran pour que elementFromPoint la voie
    const cibles: (string | null)[][] = [];
    for (const visuel of await page.locator(".univers-card__visuel").all()) {
      await visuel.scrollIntoViewIfNeeded();
      cibles.push(
        await visuel.evaluate((v) => {
          const b = v.getBoundingClientRect();
          return [
            [b.left + 4, b.top + 4],
            [b.right - 4, b.bottom - 4],
          ].map(([x, y]) => document.elementFromPoint(x!, y!)?.closest("a")?.getAttribute("href") ?? null);
        }),
      );
    }
    expect(cibles).toEqual([
      ["/pro/", "/pro/"],
      ["/jeux/", "/jeux/"],
    ]);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`thème ${scheme} : titre des univers à la couleur de sa pochette`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      const couleurs = await page.locator(".univers-card__visuel").evaluateAll((els) =>
        els.map((el) => [getComputedStyle(el).color, getComputedStyle(el.querySelector(".univers-card__title a")!).color]),
      );
      for (const [pochette, titre] of couleurs) expect(titre).toBe(pochette);
    });
  }

  test("titre et description présentent toute la personnalité", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Ryan Cardamone — Informaticien, pilote, gamer et passionné de musique");
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toMatch(/pilote/);
    expect(description).toMatch(/gamer/);
    expect(description).toMatch(/musique/);
  });
});

/* ======================================================================
   Pro : région, disponibilité, CV, projets, parcours (contenu inchangé)
   ====================================================================== */
test("Pro : métier, région, disponibilité, CV, projets et parcours", async ({ page }) => {
  await page.goto("/pro/");
  await expect(page.locator("h1")).toHaveText("Professionnel");
  await expect(page).toHaveTitle("Professionnel — Ryan Cardamone");
  await expect(page.locator(".pro__role")).toHaveText("Informaticien CFC — exploitation et infrastructure");
  await expect(page.locator(".pro__facts")).toContainText("Région : Lausanne");
  await expect(page.locator(".pro__facts")).toContainText("Disponible dès maintenant jusqu'en février 2027.");
  await expect(page.getByRole("link", { name: /Télécharger le CV/ })).toHaveAttribute("href", "/Ryan-Cardamone-CV.pdf");
  await expect(page.locator("#projets .card")).toHaveCount(2);
  await expect(page.locator("#parcours .etape")).not.toHaveCount(0);
  await expect(page.locator("#parcours .groupe")).not.toHaveCount(0);
  // Une seule hiérarchie de titres : h1, puis h2 de section
  await expect(page.locator("h2.section-title")).toHaveText(["Projets IT", "Parcours"]);
  await expect(page.locator(".section-count").first()).toHaveText(/02\s*projets publiés/i);
});

/* ======================================================================
   Jeux : favoris, champs vides non affichés, liens externes simples
   ====================================================================== */
test.describe("Jeux", () => {
  test("six favoris dans l'ordre, champs vides non affichés, aucune image ni logo", async ({ page }) => {
    await page.goto("/jeux/");
    await expect(page.locator(".jeu__titre")).toHaveText(FAVORIS);
    await expect(page.locator(".jeu__num")).toHaveText(FAVORIS.map((_, i) => `0${i + 1}`));
    // Aucun champ facultatif renseigné → ni plateforme, ni niveau, ni texte
    await expect(page.locator(".jeu__infos, .jeu__texte")).toHaveCount(0);
    await expect(page.getByText("Plateforme")).toHaveCount(0);
    // Visuels typographiques : aucune image dans les favoris
    await expect(page.locator(".favoris img")).toHaveCount(0);
    await expect(page.locator(".jeu__visuel")).toHaveCount(6);
    // Dans les favoris, le nom de chaque jeu n'apparaît qu'une fois (dans sa
    // pochette, comme titre). Les listes Steam peuvent, elles, citer le même jeu.
    const favoris = page.locator(".favoris");
    for (const titre of FAVORIS) {
      await expect(favoris.getByText(titre, { exact: true }), titre).toHaveCount(1);
      await expect(favoris.getByRole("heading", { level: 3, name: titre }), titre).toHaveCount(1);
      // Hors favoris, seule la section Steam peut contenir ce nom
      const ailleurs = await page.locator("main").evaluate(
        (main, t) =>
          [...main.querySelectorAll("*")].filter(
            (el) => el.children.length === 0 && el.textContent?.trim() === t && !el.closest(".favoris, [data-steam]"),
          ).length,
        titre,
      );
      expect(ailleurs, `${titre} répété hors favoris et Steam`).toBe(0);
    }
    // Aucune légende vide sous les pochettes
    await expect(page.locator(".jeu__caption")).toHaveCount(0);
    // Même format de numéro partout sur la page ; compteur « 06 FAVORIS » conservé
    await expect(page.locator("main")).not.toContainText("N°");
    await expect(page.locator(".section-count").first()).toHaveText(/06\s*favoris/i);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`thème ${scheme} : numéro et titre à la couleur de leur pochette`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/jeux/");
      const couleurs = await page.locator(".jeu__visuel").evaluateAll((els) =>
        els.map((el) => [
          getComputedStyle(el).color,
          getComputedStyle(el.querySelector(".jeu__num")!).color,
          getComputedStyle(el.querySelector(".jeu__titre")!).color,
        ]),
      );
      for (const [pochette, num, titre] of couleurs) {
        expect(num).toBe(pochette);
        expect(titre).toBe(pochette);
      }
    });
  }

  for (const width of [375, 768, 1440, 1920]) {
    test(`${width} px : cartes compactes, hauteur égale à la largeur`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/jeux/");
      await page.evaluate(() => document.fonts.ready);
      const cartes = await page.locator(".jeu__visuel").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          const titre = el.querySelector(".jeu__titre")!.getBoundingClientRect();
          return { ratio: r.height / r.width, titreDedans: titre.bottom <= r.bottom + 0.5 && titre.right <= r.right + 0.5 };
        }),
      );
      for (const c of cartes) {
        expect(Math.abs(c.ratio - 1)).toBeLessThan(0.02);
        expect(c.titreDedans, "titre entièrement dans la pochette").toBe(true);
      }
    });
  }

  test("Steam et Medal : simples liens, aucun contenu tiers chargé", async ({ page }) => {
    const watched = watchPage(page);
    await page.goto("/jeux/");
    await page.waitForLoadState("networkidle");
    const steam = page.getByRole("link", { name: "Profil Steam" });
    const medal = page.getByRole("link", { name: "Clips sur Medal" });
    await expect(steam).toHaveAttribute("href", "https://steamcommunity.com/id/W1mdra_/");
    await expect(medal).toHaveAttribute("href", "https://medal.tv/u/W1mdra_");
    // Conditions de Steam : pas de « nofollow » sur les liens vers Valve
    await expect(steam).not.toHaveAttribute("rel", /nofollow/);
    // Aucun lecteur, iframe, script ou image d'un autre site
    await expect(page.locator("iframe, video, embed, object")).toHaveCount(0);
    const tiers = await page.evaluate((origin) =>
      [...document.querySelectorAll<HTMLElement>("script[src], img, link[href], source")]
        .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
        .filter((u) => u && new URL(u, location.href).origin !== origin && !u.startsWith("https://portfolio.cardamone-online.ch")),
    SITE_ORIGIN);
    expect(tiers).toEqual([]);
    expect(watched.externalRequests).toEqual([]);
  });

  test("section Steam : affichée seulement avec des données valides, sans donnée privée", async ({ page }) => {
    const fichier = path.join(process.cwd(), ".steam", "steam.json");
    await page.goto("/jeux/");
    const section = page.locator("[data-steam]");
    if (!existsSync(fichier)) {
      // Pas de clé ou profil privé : aucune section, aucune donnée inventée
      await expect(section).toHaveCount(0);
      await expect(page.getByText(/jeux? possédés?/)).toHaveCount(0);
      await expect(page.getByText(/Temps de jeu/)).toHaveCount(0);
    } else {
      const data = JSON.parse(readFileSync(fichier, "utf8")) as { jeuxPossedes: number; plusJoues: { nom: string }[] };
      await expect(section).toHaveCount(1);
      await expect(section.locator(".section-count__n")).toHaveText(String(data.jeuxPossedes));
      if (data.plusJoues[0]) await expect(section).toContainText(data.plusJoues[0].nom);
    }
    // Jamais de statut en ligne, de jeu en cours ni de pays
    const texte = (await page.locator("main").innerText()).toLowerCase();
    for (const interdit of ["en ligne", "en train de jouer", "actuellement", "pays"]) {
      expect(texte, interdit).not.toContain(interdit);
    }
  });
});

/* ======================================================================
   Clé Steam : jamais dans le site généré
   ====================================================================== */
test("aucune clé ni trace de l'API Steam dans dist/", () => {
  const dist = path.join(process.cwd(), "dist");
  const fichiers = readdirSync(dist, { recursive: true })
    .map(String)
    .filter((f) => /\.(html|js|css|xml|txt|json)$/.test(f));
  expect(fichiers.length).toBeGreaterThan(5);
  const problemes: string[] = [];
  const cle = process.env.STEAM_API_KEY?.trim();
  for (const f of fichiers) {
    const contenu = readFileSync(path.join(dist, f), "utf8");
    if (/\b[0-9A-F]{32}\b/.test(contenu)) problemes.push(`${f} : chaîne au format d'une clé Steam`);
    if (/x-webapi-key|STEAM_API_KEY|api\.steampowered\.com|steamid/i.test(contenu)) problemes.push(`${f} : trace de l'API Steam`);
    if (cle && contenu.includes(cle)) problemes.push(`${f} : clé Steam`);
  }
  expect(problemes).toEqual([]);
});
