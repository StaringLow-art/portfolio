/**
 * Prépare une photo pour le site, en local, sans modifier l'original.
 * Usage : npm run clean:image -- <original.jpg> <destination.jpg|.png|.webp>
 *
 * - applique l'orientation de l'appareil photo (photo redressée) ;
 * - réduit à 2400 px au plus sur le plus grand côté (jamais agrandie) ;
 * - réécrit l'image SANS aucune métadonnée : EXIF, GPS, XMP, IPTC,
 *   appareil, date… (sharp ne les recopie pas) ;
 * - vérifie ensuite qu'il ne reste ni GPS ni EXIF.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import exifr from "exifr";
import sharp from "sharp";

const [entree, sortie] = process.argv.slice(2);
if (!entree || !sortie || path.resolve(entree) === path.resolve(sortie)) {
  console.error("Usage : npm run clean:image -- <original> <destination> (destination différente de l'original)");
  process.exit(1);
}
if (!existsSync(entree)) {
  console.error(`Fichier introuvable : ${entree}`);
  process.exit(1);
}

const ext = path.extname(sortie).toLowerCase();
// exifr lit le contenu du fichier (et non son chemin) : fonctionne avec toutes
// les versions de Node (la lecture par chemin échoue sous Node 26).
const gpsAvant = await exifr.gps(readFileSync(entree)).catch(() => undefined);
mkdirSync(path.dirname(path.resolve(sortie)), { recursive: true });

let image = sharp(entree).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
if (ext === ".jpg" || ext === ".jpeg") image = image.jpeg({ quality: 90, mozjpeg: true });
else if (ext === ".png") image = image.png();
else if (ext === ".webp") image = image.webp({ quality: 90 });
else {
  console.error("Format de destination attendu : .jpg, .png ou .webp");
  process.exit(1);
}
const info = await image.toFile(sortie);

// Vérification : aucune métadonnée restante
const meta = await sharp(sortie).metadata();
const blocs = (["exif", "xmp", "iptc"] as const).filter((b) => meta[b] !== undefined);
const gpsApres = await exifr.gps(readFileSync(sortie)).catch(() => undefined);
if (blocs.length > 0 || gpsApres?.latitude !== undefined) {
  console.error(`  ✗ métadonnées encore présentes (${blocs.join(", ") || "GPS"}) : ne pas publier ce fichier`);
  process.exit(1);
}
const gps = gpsAvant?.latitude !== undefined ? " (position GPS retirée)" : "";
console.log(`  ✓ ${path.basename(sortie)} : ${info.width} × ${info.height} px, sans métadonnées${gps}`);
