# Portfolio de Ryan Cardamone

Site personnel statique, publié sur **https://portfolio.cardamone-online.ch**.

- [Astro](https://astro.build) 7, TypeScript strict, aucun framework JavaScript côté navigateur
- Hébergement : GitHub Pages, publié automatiquement par GitHub Actions
- Aucun cookie, aucune statistique, aucune ressource externe

---

## 1. Installation sur un nouvel ordinateur

### Ce qu'il faut

| Outil | Version | Pourquoi |
|---|---|---|
| Node.js | **24.22.1** (écrite dans `.nvmrc`) | fait tourner Astro et les scripts |
| Git | récente | versionne le projet |
| VS Code, GitHub Desktop | facultatifs | édition et commits |

`npm` refuse de s'installer avec une autre version majeure de Node (réglage `engine-strict` dans `.npmrc`).

### Windows (testé)

Dans PowerShell, depuis le dossier du projet :

```powershell
winget install OpenJS.NodeJS.LTS     # installe Node.js (puis rouvrir le terminal)
node --version                       # doit afficher v24.22.x ou plus récent en 24
npm ci                               # installe les dépendances exactes de package-lock.json
npx playwright install chromium firefox   # navigateurs utilisés par les tests
npx astro telemetry disable          # désactive la télémétrie d'Astro (voir plus bas)
npm run verify                       # vérifie que tout fonctionne
```

### Fedora KDE (NON testé)

> ⚠️ **Ces étapes n'ont pas pu être testées** : le PC de développement n'a ni Fedora, ni WSL, ni Docker.
> Elles s'appuient sur la documentation officielle de Playwright, qui ne liste que Debian 12/13 et
> Ubuntu 22.04/24.04/26.04 comme systèmes Linux pris en charge. **Fedora n'est pas officiellement pris
> en charge**. Ce qui suit est donc une marche à suivre à vérifier lors de la première installation.

```bash
sudo dnf install git nodejs          # puis vérifier la version :
node --version                       # il faut v24.22 ou plus récent en 24
```

Si la version proposée par Fedora n'est pas une 24.x récente, la commande `dnf list --available 'nodejs*'`
montre les versions disponibles ; sinon, installer Node 24 avec un gestionnaire de versions
(par exemple [fnm](https://github.com/Schniz/fnm), qui lit `.nvmrc` : `fnm install && fnm use`).

Ensuite, dans le dossier du projet :

```bash
npm ci
npx playwright install chromium firefox   # SANS --with-deps : cette option installe les
                                          # bibliothèques système avec apt (Debian/Ubuntu)
npx astro telemetry disable
npm run verify
```

Si un navigateur refuse de démarrer, Playwright affiche le nom des bibliothèques manquantes.
On cherche alors le paquet Fedora correspondant avec `dnf provides '*/<nom-de-la-bibliothèque>'`,
puis on l'installe avec `sudo dnf install <paquet>`. Sur un bureau KDE complet, la plupart sont déjà présentes.
Liste **indicative et non testée** des paquets souvent demandés :

```bash
sudo dnf install nss atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite \
  libXdamage libXrandr mesa-libgbm pango alsa-lib
```

Dernier recours, toujours non testé : lancer les tests dans l'image Docker officielle de Playwright
avec Podman (installé par défaut sur Fedora). Vérifier d'abord que la version de Node de l'image
est bien une 24.22 ou plus récente :

```bash
podman run --rm -it -v "$PWD":/work:Z -w /work mcr.microsoft.com/playwright:v1.64.1-noble \
  bash -c "node --version && npm ci && npm run verify"
```

Après ce test, relancer `npm ci` hors du conteneur pour retrouver des dépendances propres à Fedora.

### Télémétrie d'Astro : à désactiver sur chaque ordinateur

Astro envoie par défaut des statistiques d'utilisation anonymes. Sur **chaque ordinateur** où le projet
est installé, une seule fois :

```
npx astro telemetry disable
```

Le réglage vaut pour tout l'ordinateur (pas seulement ce projet). Dans GitHub Actions, la télémétrie est
coupée par la variable `ASTRO_TELEMETRY_DISABLED=1` du workflow.

---

## 2. Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | site de développement, rechargé à chaque modification : http://localhost:4321 |
| `npm run build` | génère le site final dans `dist/` |
| `npm run preview` | sert le contenu de `dist/` (lancer `build` avant) |
| `npm run check` | vérifie le code (TypeScript, Astro) et le contenu |
| `npm run test` | tests Playwright et accessibilité (sur le site généré) |
| `npm run check:privacy` | cherche IP, numéros, e-mails, clés et métadonnées dans le projet et `dist/` |
| `npm run check:launch` | échoue s'il manque un contenu indispensable avant la mise en ligne |
| `npm run verify` | enchaîne `check`, `build`, `test` et `check:privacy` |
| `npm run lighthouse` | mesures Lighthouse (mobile) ; rapports dans `lighthouse/`, non versionné |
| `npm run clean:pdf -- <original.pdf> <destination.pdf>` | retire les métadonnées et le contenu caché d'un PDF |
| `npm run prepare:photo -- <original.png> [--flip]` | prépare le portrait (noir et blanc, grain, sans métadonnées) |
| `npm run generate:images` | régénère l'image de partage et les icônes à partir de `site.ts` |
| `npm run steam:fetch` | met à jour les données Steam (`.steam/`, hors Git) si la variable `STEAM_API_KEY` est définie |

**Avant chaque publication** : `npm run verify` puis `npm run check:launch` doivent réussir.
GitHub Actions refait exactement ces contrôles et ne publie rien en cas d'échec.

---

## 3. Opérations courantes

### Lancer le site en local

```
npm run dev
```

Puis ouvrir http://localhost:4321. `Ctrl + C` dans le terminal arrête le serveur.

### Organisation du site

| Page | Contenu |
|---|---|
| `/` | héros (nom, portrait, présentation) et univers du site |
| `/pro/` | métier, région, disponibilité, CV, projets (`#projets`) et parcours (`#parcours`) |
| `/jeux/` | jeux favoris, données Steam (si disponibles), liens Steam et Medal |
| `/projets/<projet>/` | page détaillée d'un projet |
| `/contact/` | adresse e-mail, CV, liens |

Les anciennes adresses `/projets/` et `/parcours/` redirigent vers les sections de `/pro/`.
GitHub Pages ne permet pas de redirection HTTP (301) : la redirection se fait dans la page, qui n'est
pas indexée et n'apparaît pas dans le sitemap.

### Modifier la présentation de l'accueil

`presentation` dans `src/config/site.ts` : elle sert au titre de la page d'accueil et au héros
(suivie de « Bienvenue dans mon univers. »). Le métier (`role`) reste affiché sur la page Pro.

### Ajouter un univers (Sport, Musique, Loisirs…)

1. Créer la page `src/pages/<slug>.astro` (par exemple en partant de `src/pages/jeux.astro`).
2. Ajouter une entrée dans `src/config/univers.ts` : `slug`, `titre`, `resume`.
3. Le menu et l'accueil se mettent à jour seuls. Ajouter la page aux listes de pages des tests
   (`tests/helpers.ts` et `tests/qualite.spec.ts`), puis `npm run verify`.

### Modifier les jeux favoris

Tout se trouve dans `src/data/jeux.ts`. Seul `titre` est obligatoire ; un champ vide (`""`) ou absent
n'est pas affiché :

```ts
{ titre: "Rainbow Six Siege", plateforme: "PC", niveau: "Or III", texte: "Une phrase.", image: "r6-capture.png", imageAlt: "Description de la capture" },
```

- `image` : nom d'une de **tes propres captures**, placée dans `src/assets/jeux/` (sans métadonnées).
  Jamais de logo ni de jaquette officielle. Sans image, une pochette typographique est générée.
- `imageAlt` est obligatoire dès qu'il y a une image.
- `npm run check` vérifie le fichier et l'existence des images.

### Données Steam

Les jeux possédés, le temps de jeu et les jeux récents sont lus **pendant la génération du site**
(jamais dans le navigateur des visiteurs), uniquement si le profil Steam est public. Rien d'autre
n'est enregistré : ni pseudo, ni avatar, ni statut en ligne, ni jeu en cours, ni pays.

**Mise en route (plus tard, quand tu le décides)** :

1. Obtenir une clé sur https://steamcommunity.com/dev/apikey (connecté à Steam ; domaine :
   `portfolio.cardamone-online.ch`). La clé est **personnelle et confidentielle** (conditions de Steam).
2. GitHub → dépôt `portfolio` → **Settings → Secrets and variables → Actions → New repository secret** :
   nom `STEAM_API_KEY`, valeur : la clé. Ne jamais l'écrire dans un fichier du projet.
3. Onglet **Actions** → « Vérifier et publier » → **Run workflow** pour une première mise à jour.

En local, pour tester, sans enregistrer la clé (Windows PowerShell 5.1 ; la saisie est masquée) :

```powershell
$s = Read-Host "Clé Steam" -AsSecureString
$env:STEAM_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
npm run steam:fetch
npm run build
Remove-Item Env:STEAM_API_KEY; Remove-Variable s
```

Sur Fedora : `read -rs STEAM_API_KEY && export STEAM_API_KEY && npm run steam:fetch && npm run build; unset STEAM_API_KEY`
(non testé, voir section 1).

**Fonctionnement et limites** :

- le workflow tourne **chaque jour vers 6 h – 7 h** (heure de Lausanne) et à chaque push ;
- si la clé manque ou si Steam ne répond pas, les **dernières données valides** sont reprises du cache de
  GitHub Actions ; sans données, la section Steam est simplement masquée. Le site reste publiable ;
- si le profil (ou le détail des jeux) devient privé, les données sont supprimées et la section disparaît ;
- GitHub peut **retarder** une exécution planifiée et la **désactive après 60 jours sans activité** sur le
  dépôt (un e-mail prévient ; il suffit de la réactiver dans l'onglet Actions) ;
- le cache de GitHub est effacé après **7 jours sans utilisation** : après une longue pause, les données
  reviennent à la prochaine exécution réussie ;
- les **forks** du dépôt ne reçoivent jamais le secret ;
- limite de Steam : 100 000 appels par jour (le site en fait 4 par exécution) ;
- la mention « ce site n'est ni affilié à Valve ni approuvé par Valve » accompagne les données, comme
  l'exigent les conditions d'utilisation de l'API Steam.

`check:privacy` refuse toute chaîne au format d'une clé Steam et, dans GitHub Actions, vérifie que la
vraie clé n'apparaît dans aucun fichier du projet, du site généré ou des données Steam.

### Clips Medal

Le lien `jeux.medal` de `src/config/site.ts` s'affiche comme simple lien externe. Aucun lecteur
vidéo n'est intégré : rien n'est chargé depuis Medal ou Steam tant que le visiteur ne clique pas.

### Ajouter un projet

1. Créer `src/content/projets/<nom-du-projet>.md` (minuscules et tirets ; ce nom devient l'adresse
   `/projets/<nom-du-projet>/`).
2. Mettre l'image de couverture dans `src/assets/projets/`, **sans métadonnées** et sans donnée sensible.
3. Remplir l'en-tête (le schéma est vérifié par `npm run check`) :

```markdown
---
title: "Titre du projet"
summary: "Une ou deux phrases pour la mosaïque."
order: 3                     # position dans la mosaïque, unique
role: "Mon rôle"
technologies: ["Proxmox", "Linux"]
cover: "../../assets/projets/mon-image.png"
coverAlt: "Description de l'image pour les personnes aveugles"
coverPosition: "50% 50%"     # facultatif : partie gardée dans la vignette
coverZoom: false             # facultatif : true pour une capture d'écran
draft: false                 # true = projet masqué partout
images: []                   # facultatif : [{ src, alt, caption }]
documents: []                # facultatif : [{ title, file: "/documents/<projet>/<fichier>.pdf" }]
---

## Contexte
…
## Ce que j'ai réalisé
…
## Résultat
…
```

La numérotation (« N°01/03 »), le compteur et le sitemap se mettent à jour seuls.
Un document PDF de projet se nettoie d'abord avec `npm run clean:pdf`, et seulement si tu as le droit
de le diffuser.

### Publier Moto Passion

Seulement **après l'accord du garage** :

1. Compléter `src/content/projets/moto-passion.md` : remplacer chaque `À_COMPLÉTER`.
2. Remplacer `src/assets/projets/moto-passion-temporaire.jpg` par la vraie image, sans `-temporaire`
   dans le nom, et mettre à jour `cover` et `coverAlt`.
3. Passer `draft: true` à `draft: false`.
4. `npm run verify` puis `npm run check:launch`.

### Modifier la disponibilité

Elle est écrite **à un seul endroit** : `availability` dans `src/config/site.ts`. Le reste du site la
reprend automatiquement. Lancer ensuite `npm run generate:images` si l'image de partage doit suivre.

### Remplacer le CV

1. Garder l'original **hors du projet** (par exemple dans `portfolio-sources/`).
2. Vérifier qu'il ne contient ni adresse postale, ni date de naissance complète, ni téléphone ou e-mail
   non autorisé.
3. Nettoyer :

   ```
   npm run clean:pdf -- ../portfolio-sources/MonCV.pdf public/Ryan-Cardamone-CV.pdf
   ```

4. `npm run check:privacy`. L'exception actuelle (coordonnées du référent, publiées avec son accord) est
   liée à l'**empreinte exacte** de l'ancien fichier. Avec un nouveau CV, elle ne s'applique plus : si le
   nouveau CV contient de nouveau des coordonnées autorisées, mettre à jour `sha256` dans `PDF_EXCEPTIONS`
   (`scripts/check-privacy.ts`). L'empreinte s'obtient avec
   `node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('public/Ryan-Cardamone-CV.pdf')).digest('hex'))"`.
   Ne jamais écrire les coordonnées elles-mêmes dans le dépôt.

### Remplacer la photo

```
npm run prepare:photo -- ../portfolio-sources/photo.png
```

Le fichier d'origine doit être déjà détouré (fond transparent). Le résultat remplace
`src/assets/photo/ryan-cardamone.png`. Ajouter `--flip` pour retourner le portrait horizontalement.

### Remplacer le logo

Le logo actuel est le nom en texte, dans `src/components/Logo.astro`. Pour un vrai logo, modifier
**uniquement ce composant** (image ou SVG), en gardant un texte accessible (`alt` ou texte masqué).
Les icônes d'onglet sont dans `public/` (`favicon-32.png`, `apple-touch-icon.png`).

### Ajouter GitHub ou LinkedIn

Dans `src/config/site.ts`, renseigner l'adresse complète :

```ts
links: {
  github: "https://github.com/<utilisateur>",   // null = lien masqué
  linkedin: "https://www.linkedin.com/in/ryancardamone/",
},
```

Les liens apparaissent automatiquement sur la page Contact et dans les données structurées de l'accueil.

---

## 4. Vie privée : règles du dépôt public

L'historique Git conserve tout, même après suppression. Avant chaque commit :

- les originaux (photos, CV, captures) restent dans `portfolio-sources/` ou `originaux/`, tous deux exclus
  de Git ;
- jamais d'adresse postale, de numéro de téléphone, de date de naissance, de secret ou de clé, même
  dans un test ;
- homelab : aucune IP, aucun nom de machine ou de domaine interne, aucun compte, port ou détail de configuration ;
- `npm run check:privacy` doit réussir.

Les PDF et images sont déclarés **binaires** dans `.gitattributes`. Git ne les modifie donc jamais, et
l'empreinte du CV reste identique sur Windows, sur Linux et dans GitHub Actions.

---

## 5. Mise en ligne (première fois)

À faire **dans cet ordre**. `<utilisateur-github>` désigne ton nom d'utilisateur GitHub.

### Étape 0 — Identité Git (une fois par ordinateur)

L'adresse e-mail des commits est **publique** dans un dépôt public. Utilise l'adresse masquée fournie par
GitHub : *Settings → Emails*, cocher **Keep my email addresses private**, puis copier l'adresse
`…@users.noreply.github.com` affichée.

```
git config --global user.name "Ryan Cardamone"
git config --global user.email "<adresse-noreply-fournie-par-GitHub>"
```

### Étape 1 — Créer le dépôt et choisir GitHub Actions

1. Sur github.com : **New repository**, nom `portfolio`, visibilité **Public**, **sans** README, sans
   `.gitignore` et sans licence (ils existent déjà dans le projet).
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Premier envoi, depuis le dossier du projet :

   ```
   git init -b main
   git add -A
   git status                     # relire la liste : aucun original, aucun fichier sensible
   git commit -m "Première version du portfolio"
   git remote add origin https://github.com/<utilisateur-github>/portfolio.git
   git push -u origin main
   ```

4. Onglet **Actions** : le workflow « Vérifier et publier » doit se terminer en vert.
   Le site est alors visible temporairement à `https://<utilisateur-github>.github.io/portfolio/`.
   Les styles et les liens peuvent y sembler cassés, c'est normal : le site est prévu pour la racine
   de son propre domaine.

### Étape 2 — Vérifier le domaine `cardamone-online.ch` (protège contre le détournement)

1. GitHub : photo de profil → **Settings** (paramètres du **compte**, pas du dépôt) → **Pages** →
   **Add a domain** → `cardamone-online.ch` → **Add domain**.
2. GitHub affiche un enregistrement **TXT** à créer : nom `_github-pages-challenge-<utilisateur-github>`
   et une valeur. Garde cette page ouverte.
3. Infomaniak : Manager → **Domaines** → `cardamone-online.ch` → **Zone DNS** (menu de gauche) →
   ajouter une entrée → **TXT** → **Suivant**.
   - Nom/source : `_github-pages-challenge-<utilisateur-github>` (seulement cette partie ; Infomaniak
     ajoute `.cardamone-online.ch`)
   - Valeur : celle donnée par GitHub
   - TTL : laisser la valeur par défaut → **Enregistrer**
4. Contrôler (PowerShell) :

   ```powershell
   Resolve-DnsName _github-pages-challenge-<utilisateur-github>.cardamone-online.ch -Type TXT
   ```

   Sur Fedora : `dig _github-pages-challenge-<utilisateur-github>.cardamone-online.ch +short TXT`
5. Retour sur GitHub → **Verify** (ou ⋯ → **Continue verifying** si la page a été fermée).
   **Laisser cet enregistrement TXT en place** ensuite.

### Étape 3 — Ajouter le domaine personnalisé au dépôt

Dépôt `portfolio` → **Settings → Pages → Custom domain** : `portfolio.cardamone-online.ch` → **Save**.
Aucun fichier `CNAME` n'est nécessaire, car le site est publié par GitHub Actions.

### Étape 4 — Créer le CNAME chez Infomaniak (et rien d'autre)

1. Dans la zone DNS, vérifier d'abord qu'il n'existe **aucune** entrée nommée `portfolio`. S'il y en a
   une, ne rien supprimer et demander conseil avant de continuer.
2. Ajouter une entrée → **CNAME** :
   - Nom/source : `portfolio`
   - Cible : `<utilisateur-github>.github.io` (**sans** `/portfolio` ni nom de dépôt). Si Infomaniak
     propose un point final, `<utilisateur-github>.github.io.` est équivalent.
   - TTL : par défaut → **Enregistrer**

### Étape 5 — Ne rien toucher d'autre

- **Aucun wildcard** (`*.cardamone-online.ch`) : GitHub le déconseille formellement, car il permet de
  détourner le domaine.
- Ne modifier **ni les MX, ni le SPF, ni le DKIM, ni le DMARC**, ni aucun enregistrement existant.
  Ils font fonctionner la messagerie `contact@cardamone-online.ch`.
- Au total, deux entrées sont ajoutées : le TXT de l'étape 2 et le CNAME de l'étape 4.

### Étape 6 — Vérifier le DNS, le site et le certificat, puis forcer HTTPS

```powershell
Resolve-DnsName portfolio.cardamone-online.ch -Type CNAME   # doit montrer <utilisateur-github>.github.io
```

Sur Fedora : `dig portfolio.cardamone-online.ch +short`

La propagation DNS peut prendre jusqu'à 24 heures (Infomaniak indique parfois 48 h). Quand
**Settings → Pages** affiche le domaine validé et le certificat prêt, cocher **Enforce HTTPS**.
Cette case peut rester grisée jusqu'à 24 heures. Si rien ne bouge après plusieurs heures, la
documentation GitHub conseille **Remove** puis de ressaisir le domaine et **Save**.

### Étape 7 — Contrôles en ligne

1. Ouvrir https://portfolio.cardamone-online.ch : cadenas présent, `http://` redirige vers `https://`.
2. Parcourir toutes les pages et télécharger le CV.
3. Vérifier que le CV en ligne est exactement le fichier contrôlé :

   ```powershell
   Invoke-WebRequest https://portfolio.cardamone-online.ch/Ryan-Cardamone-CV.pdf -OutFile $env:TEMP\cv-en-ligne.pdf
   (Get-FileHash $env:TEMP\cv-en-ligne.pdf).Hash.ToLower()
   (Get-FileHash public\Ryan-Cardamone-CV.pdf).Hash.ToLower()   # les deux lignes doivent être identiques
   ```

4. Outils de développement du navigateur (`F12`) → Console : aucune erreur.
5. Envoyer un e-mail de test à `contact@cardamone-online.ch` et vérifier qu'il arrive.

---

## 6. Publications suivantes

Chaque `git push` sur `main` (ou **Push origin** dans GitHub Desktop), ainsi qu'une exécution
quotidienne, relancent le workflow `.github/workflows/deploy.yml` :

1. installation exacte avec `npm ci` ;
2. installation de Chromium et Firefox pour les tests ;
3. données Steam : reprise des dernières données valides, puis mise à jour (seule étape, avec la
   vérification finale, à recevoir le secret `STEAM_API_KEY`) ;
4. `npm run verify` ;
5. `npm run check:launch` ;
6. vérification que la clé Steam n'apparaît nulle part ;
7. publication sur GitHub Pages **uniquement si tout a réussi**.

En cas d'échec, l'ancienne version reste en ligne. Le détail de l'erreur se trouve dans l'onglet **Actions**.
