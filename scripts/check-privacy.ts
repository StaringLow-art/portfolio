/**
 * Contrôle de vie privée : fichiers versionnés + dossier de sortie (dist/).
 * Recherche : IP privées ou Tailscale, domaines .ts.net, numéros suisses,
 * clés et jetons, e-mails autres que l'adresse de contact, adresses postales
 * (dans le contenu et les PDF), métadonnées des images et des PDF.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import exifr from "exifr";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNull, PDFNumber, PDFRef, PDFStream } from "pdf-lib";
import sharp from "sharp";
import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { DIST, ROOT, Report, listProjectFiles, walk } from "./lib.ts";
import { site } from "../src/config/site.ts";
import { steamDataSchema } from "../src/schemas/steam.ts";

const report = new Report("Contrôle de vie privée");

const ALLOWED_EMAILS = new Set([site.email.toLowerCase()]);

const TEXT_EXT = new Set([
  ".astro", ".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json", ".md", ".mdx",
  ".css", ".html", ".xml", ".txt", ".yml", ".yaml", ".svg", ".webmanifest", ".toml",
]);
const TEXT_NAMES = new Set([".gitignore", ".gitattributes", ".npmrc", ".nvmrc", "CNAME"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff", ".heic", ".gif"]);

/**
 * package-lock.json est généré par npm : il ne contient que des noms,
 * versions et empreintes de paquets, dont les longues chaînes produiraient
 * de faux positifs.
 */
const SKIP = new Set(["package-lock.json"]);

type Rule = { name: string; re: RegExp };

const RULES: Rule[] = [
  { name: "IP privée", re: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g },
  { name: "IP Tailscale (plage CGNAT)", re: /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}\b/g },
  { name: "IPv6 locale ou Tailscale", re: /\bf[cd][0-9a-f]{2}(?::[0-9a-f]{0,4}){2,7}\b/gi },
  { name: "domaine Tailscale (.ts.net)", re: /[a-z0-9-]\.ts\.net\b/gi },
  { name: "numéro suisse (+41)", re: /(?:\+|\b00)41[\s./-]*(?:\(0\)[\s./-]*)?\d{2}[\s./-]*\d{3}[\s./-]*\d{2}[\s./-]*\d{2}\b/g },
  { name: "numéro suisse (0xx)", re: /(?<![\w.])0[1-9]\d[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}(?![\w.])/g },
  { name: "clé privée", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "clé SSH", re: /\bssh-(?:rsa|ed25519|dss) AAAA[0-9A-Za-z+/]{20,}/g },
  { name: "jeton GitHub", re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g },
  { name: "clé Tailscale", re: /\btskey-[A-Za-z0-9-]{10,}/g },
  { name: "clé AWS", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "clé Google", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "jeton Slack", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: "clé d'API (sk-)", re: /\bsk-[A-Za-z0-9_-]{20,}/g },
  // Les clés de l'API Steam : 32 caractères hexadécimaux en majuscules
  { name: "clé d'API Steam probable", re: /\b[0-9A-F]{32}\b/g },
];

const ADDRESS_RULE: Rule = {
  name: "adresse postale",
  re: /\b(?:rue|chemin|ch\.|avenue|av\.|route|rte|boulevard|bd|place|impasse|allée|sentier|quai|ruelle)\s+(?:de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+|d['’])?[\p{Lu}][\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3}\s+\d{1,4}[a-z]?\b/giu,
};

/** Date complète probable de naissance (jj.mm.aaaa, année 1990 à 2012). */
const BIRTHDATE_RULE: Rule = {
  name: "date de naissance complète",
  re: /\b(?:0?[1-9]|[12]\d|3[01])[./-](?:0?[1-9]|1[0-2])[./-](?:199\d|200\d|201[0-2])\b/g,
};

const EMAIL_RULE = "adresse e-mail non autorisée";
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/**
 * Exceptions validées par Ryan, limitées à UN fichier précis, identifié par son
 * empreinte SHA-256 : si le fichier change (même d'un octet), l'exception ne
 * s'applique plus et le contrôle échoue, ce qui impose une nouvelle vérification.
 * Seules des catégories et des nombres maximaux figurent ici, jamais les données.
 */
const PDF_EXCEPTIONS: Record<string, { sha256: string; allow: Record<string, number>; raison: string }> = {
  "Ryan-Cardamone-CV.pdf": {
    sha256: "1502d6dfe6e0c8ac522a3823264d30cee6f38ebce6b9f76c4545ae6d2328c9a0",
    allow: { "numéro suisse (+41)": 1, [EMAIL_RULE]: 1 },
    raison: "coordonnées du référent, publiées avec son accord (confirmé par Ryan le 6.11.2026)",
  },
};

type Allowance = Record<string, number>;

/**
 * Masque la valeur trouvée dans les messages : les journaux (y compris ceux,
 * publics, de GitHub Actions) ne doivent jamais recopier une donnée sensible.
 * On garde les 2 premiers caractères et la forme pour aider à la retrouver.
 */
function mask(value: string): string {
  const v = value.replace(/\s+/g, " ").trim();
  return v.slice(0, 2) + v.slice(2, 40).replace(/[\p{L}\p{N}]/gu, "•");
}

function scanText(label: string, text: string, withAddress: boolean, allowance: Allowance = {}): void {
  const rules = withAddress ? [...RULES, ADDRESS_RULE, BIRTHDATE_RULE] : RULES;
  const fail = (rule: string, found: string) => {
    if ((allowance[rule] ?? 0) > 0) {
      allowance[rule]!--;
      return;
    }
    report.fail(`${label} : ${rule} « ${mask(found)} »`);
  };
  for (const rule of rules) {
    for (const match of text.matchAll(rule.re)) fail(rule.name, match[0]);
  }
  for (const match of text.matchAll(EMAIL_RE)) {
    if (!ALLOWED_EMAILS.has(match[0].toLowerCase())) fail(EMAIL_RULE, match[0]);
  }
}

/** Métadonnées d'image tolérées (purement techniques). */
const BENIGN_IMAGE_TAGS = new Set([
  "Orientation", "XResolution", "YResolution", "ResolutionUnit", "ColorSpace",
  "ExifImageWidth", "ExifImageHeight", "YCbCrPositioning", "ImageWidth", "ImageHeight",
  "BitDepth", "ColorType", "Compression", "Filter", "Interlace", "PixelXDimension", "PixelYDimension",
]);

async function checkImage(label: string, absolute: string): Promise<void> {
  // 1. sharp lit tous les formats (JPEG, PNG, WebP, AVIF, TIFF, GIF) :
  //    présence de blocs EXIF / XMP / IPTC ?
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(absolute).metadata();
  } catch (error) {
    report.fail(`${label} : image illisible, métadonnées non vérifiables (${error instanceof Error ? error.message : error})`);
    return;
  }
  const blocks = (["exif", "xmp", "iptc"] as const).filter((b) => meta[b] !== undefined);
  if (blocks.length === 0) return;

  // 2. Détail des balises quand exifr sait les lire ; seules les balises
  //    purement techniques sont tolérées.
  let tags: Record<string, unknown> | undefined;
  try {
    // Lecture du contenu (et non du chemin) : fonctionne avec toutes les versions de Node
    tags = await exifr.parse(readFileSync(absolute), { tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: false, jfif: false, ihdr: false });
  } catch {
    tags = undefined;
  }
  if (!tags) {
    report.fail(`${label} : métadonnées présentes (${blocks.join(", ")}) à retirer`);
    return;
  }
  const sensitive = Object.keys(tags).filter((key) => !BENIGN_IMAGE_TAGS.has(key));
  if (sensitive.length > 0) {
    report.fail(`${label} : métadonnées à retirer (${sensitive.slice(0, 8).join(", ")}${sensitive.length > 8 ? "…" : ""})`);
  }
}

/** Objets cachés : pièces jointes, ou objets non reliés au document affiché
 *  (ex. le .docx source qu'ONLYOFFICE glisse dans ses PDF). */
async function checkPdfHiddenObjects(label: string, bytes: Buffer): Promise<void> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const { context } = doc;
  const names = doc.catalog.lookup(PDFName.of("Names"));
  if (names instanceof PDFDict && names.has(PDFName.of("EmbeddedFiles"))) report.fail(`${label} : pièce jointe cachée dans le PDF`);
  if (doc.catalog.has(PDFName.of("AF"))) report.fail(`${label} : fichier associé caché dans le PDF`);
  const reachable = new Set<string>();
  const visit = (value: unknown): void => {
    if (value instanceof PDFRef) {
      if (reachable.has(value.toString())) return;
      reachable.add(value.toString());
      visit(context.lookup(value));
    } else if (value instanceof PDFDict) {
      for (const [, v] of value.entries()) visit(v);
    } else if (value instanceof PDFArray) {
      for (const v of value.asArray()) visit(v);
    } else if (value instanceof PDFStream) {
      visit(value.dict);
    }
  };
  visit(context.trailerInfo.Root);
  visit(context.trailerInfo.Info);
  // Seuls les objets pouvant porter des données comptent (flux, dictionnaires,
  // chaînes, tableaux) ; un nombre isolé (reste de /Length) ne cache rien.
  const orphans = context
    .enumerateIndirectObjects()
    .filter(([ref, obj]) => !reachable.has(ref.toString()) && !(obj instanceof PDFNumber) && obj !== PDFNull).length;
  if (orphans > 0) report.fail(`${label} : ${orphans} objet(s) caché(s) non utilisé(s) (document source possible) — utiliser « npm run clean:pdf »`);
}

async function checkPdf(label: string, absolute: string): Promise<void> {
  const bytes = readFileSync(absolute);
  await checkPdfHiddenObjects(label, bytes);
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { info, metadata } = await getMeta(pdf);
  const infoRecord = (info ?? {}) as unknown as Record<string, unknown>;

  for (const key of ["Author", "Subject", "Keywords", "Custom"]) {
    const value = infoRecord[key];
    const filled = typeof value === "string" ? value.trim() !== "" : value != null && Object.keys(value as object).length > 0;
    if (filled) report.fail(`${label} : métadonnée PDF « ${key} » à retirer`);
  }
  for (const key of ["Title", "Creator", "Producer"]) {
    const value = infoRecord[key];
    if (typeof value === "string" && value.trim() !== "") report.warn(`${label} : métadonnée PDF « ${key} » = « ${value} » (à vérifier)`);
  }
  const xmp = (metadata as { getAll?: () => Record<string, unknown> } | null)?.getAll?.() ?? {};
  for (const key of Object.keys(xmp)) {
    if (/creator$|author|pdf:keywords|photoshop:|xmprights:/i.test(key) && key !== "xmp:creatortool") {
      report.fail(`${label} : métadonnée XMP « ${key} » à retirer`);
    }
  }

  // Exception éventuelle : seulement si le fichier est EXACTEMENT celui validé
  const exception = PDF_EXCEPTIONS[path.basename(absolute)];
  let allowance: Allowance = {};
  if (exception) {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 === exception.sha256) {
      allowance = { ...exception.allow };
      report.ok(`${label} : exception appliquée (${exception.raison})`);
    } else {
      report.warn(`${label} : le fichier a changé, l'exception validée ne s'applique plus`);
    }
  }
  const { text } = await extractText(pdf, { mergePages: true });
  scanText(`${label} (texte du PDF)`, text, true, allowance);
}

async function checkFile(label: string, absolute: string, isContent: boolean): Promise<void> {
  const base = path.basename(absolute);
  const ext = path.extname(absolute).toLowerCase();
  if (SKIP.has(base)) return;

  if (TEXT_EXT.has(ext) || TEXT_NAMES.has(base)) {
    scanText(label, readFileSync(absolute, "utf8"), isContent);
  } else if (IMAGE_EXT.has(ext)) {
    await checkImage(label, absolute);
  } else if (ext === ".pdf") {
    await checkPdf(label, absolute);
  }
}

// Fichiers du projet
const projectFiles = listProjectFiles();
for (const file of projectFiles) {
  const isContent = file.startsWith("src/content/") || file.startsWith("src/data/");
  await checkFile(file, path.join(ROOT, file), isContent);
}
report.ok(`${projectFiles.length} fichiers du projet analysés`);

// Dossier de sortie
if (!existsSync(DIST)) {
  report.fail("dossier dist/ absent : lancer d'abord « npm run build »");
} else {
  const distFiles = walk(DIST, new Set());
  for (const file of distFiles) {
    await checkFile(`dist/${file}`, path.join(DIST, file), file.endsWith(".html"));
  }
  report.ok(`${distFiles.length} fichiers de dist/ analysés`);
}

// Données Steam (.steam/steam.json, hors Git) : uniquement des noms de jeux
// et des durées, conformes au schéma strict (aucun champ en plus).
const STEAM_FILE = path.join(ROOT, ".steam", "steam.json");
if (existsSync(STEAM_FILE)) {
  try {
    const parsed = steamDataSchema.safeParse(JSON.parse(readFileSync(STEAM_FILE, "utf8")));
    if (parsed.success) report.ok(".steam/steam.json : uniquement des noms de jeux et des durées");
    else report.fail(".steam/steam.json : contenu non conforme (champ inattendu ou invalide)");
  } catch {
    report.fail(".steam/steam.json : illisible");
  }
  scanText(".steam/steam.json", readFileSync(STEAM_FILE, "utf8"), false);
}

// Clé Steam réelle (si fournie, comme dans GitHub Actions) : absente partout.
// Elle n'est jamais affichée, même en cas d'échec.
const steamKey = process.env.STEAM_API_KEY?.trim();
if (steamKey) {
  const where: string[] = [];
  const all = [
    ...projectFiles.map((f) => [f, path.join(ROOT, f)] as const),
    ...(existsSync(DIST) ? walk(DIST, new Set()).map((f) => [`dist/${f}`, path.join(DIST, f)] as const) : []),
    ...(existsSync(STEAM_FILE) ? [[".steam/steam.json", STEAM_FILE] as const] : []),
  ];
  for (const [label, absolute] of all) {
    if (readFileSync(absolute).includes(steamKey)) where.push(label);
  }
  if (where.length) report.fail(`clé STEAM_API_KEY trouvée dans : ${where.join(", ")}`);
  else report.ok(`clé STEAM_API_KEY absente des ${all.length} fichiers analysés`);
}

report.finish();
