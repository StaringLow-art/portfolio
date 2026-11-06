/**
 * Nettoie un PDF de ses métadonnées, en local, sans modifier l'original.
 * Usage : npm run clean:pdf -- <original.pdf> <destination.pdf>
 *
 * - retire le dictionnaire /Info (auteur, titre, logiciel, dates…) ;
 * - retire tous les paquets XMP (/Metadata), du document comme des objets
 *   (images, polices…), ainsi que /PieceInfo ;
 * - retire les pièces jointes (/EmbeddedFiles, /AF) ;
 * - supprime tout objet non utilisé par le document affiché : certains
 *   logiciels (ex. ONLYOFFICE) y cachent le document source complet (.docx),
 *   avec son auteur, son texte et ses images d'origine ;
 * - réécrit entièrement le fichier : aucune mise à jour incrémentale, donc
 *   aucune ancienne métadonnée récupérable dans le fichier ;
 * - vérifie que le texte et le nombre de pages sont identiques à l'original.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, PDFStream } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";

const [input, output] = process.argv.slice(2);
if (!input || !output || path.resolve(input) === path.resolve(output)) {
  console.error("Usage : npm run clean:pdf -- <original.pdf> <destination.pdf> (destination différente de l'original)");
  process.exit(1);
}

const original = readFileSync(input);
const doc = await PDFDocument.load(original, { updateMetadata: false });
const { context } = doc;

// 1. Dictionnaire /Info du fichier
const infoRef = context.trailerInfo.Info;
if (infoRef instanceof PDFRef) context.delete(infoRef);
context.trailerInfo.Info = undefined;

// 2. Paquets XMP et /PieceInfo, partout
let removed = 0;
for (const [, object] of context.enumerateIndirectObjects()) {
  const dict = object instanceof PDFDict ? object : object instanceof PDFStream ? object.dict : null;
  if (!dict) continue;
  for (const key of ["Metadata", "PieceInfo"]) {
    const value = dict.get(PDFName.of(key));
    if (value === undefined) continue;
    if (value instanceof PDFRef) context.delete(value);
    dict.delete(PDFName.of(key));
    removed++;
  }
}
const catalog = doc.catalog;
for (const key of ["Metadata", "PieceInfo"]) {
  const value = catalog.get(PDFName.of(key));
  if (value instanceof PDFRef) context.delete(value);
  if (value !== undefined) {
    catalog.delete(PDFName.of(key));
    removed++;
  }
}

// 3. Pièces jointes du document
const names = catalog.lookup(PDFName.of("Names"));
if (names instanceof PDFDict && names.has(PDFName.of("EmbeddedFiles"))) {
  names.delete(PDFName.of("EmbeddedFiles"));
  removed++;
}
if (catalog.has(PDFName.of("AF"))) {
  catalog.delete(PDFName.of("AF"));
  removed++;
}

// 4. Objets non utilisés : on garde seulement ce qui est relié au catalogue
const reachable = new Set<string>();
const visit = (value: unknown): void => {
  if (value instanceof PDFRef) {
    const key = value.toString();
    if (reachable.has(key)) return;
    reachable.add(key);
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
let orphans = 0;
let orphanBytes = 0;
for (const [ref, object] of context.enumerateIndirectObjects()) {
  if (reachable.has(ref.toString())) continue;
  if (object instanceof PDFRawStream) orphanBytes += object.contents.length;
  context.delete(ref);
  orphans++;
}

// 5. Réécriture complète (sans les objets supprimés)
const cleaned = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
writeFileSync(output, cleaned);

// 6. Contrôle : même texte, même nombre de pages
const text = async (bytes: Uint8Array) => {
  const pdf = await getDocumentProxy(bytes);
  const { text: t } = await extractText(pdf, { mergePages: true });
  return { pages: pdf.numPages, text: t };
};
const before = await text(new Uint8Array(original));
const after = await text(new Uint8Array(cleaned));
if (before.pages !== after.pages || before.text !== after.text) {
  console.error("  ✗ Le texte ou le nombre de pages a changé : fichier nettoyé à vérifier.");
  process.exit(1);
}
console.log(`  ✓ ${path.basename(output)} : ${removed} bloc(s) de métadonnées retiré(s), /Info supprimé`);
console.log(`    ${orphans} objet(s) non utilisé(s) supprimé(s) (${orphanBytes} octets de flux cachés)`);
console.log(`    texte identique (${after.pages} page(s)) ; ${original.length} → ${cleaned.length} octets`);
