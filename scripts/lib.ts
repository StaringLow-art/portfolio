/**
 * Outils partagés par les scripts de contrôle.
 * Uniquement des modules Node : fonctionne sous Windows et sous Linux.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const DIST = path.join(ROOT, "dist");

/** Dossiers jamais publiés ni versionnés. */
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".astro",
  "test-results",
  "playwright-report",
  "lighthouse",
  "originaux",
]);

/** Liste récursive des fichiers d'un dossier (chemins relatifs, séparateur « / »). */
export function walk(dir: string, ignore = IGNORED_DIRS): string[] {
  const out: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignore.has(entry.name)) visit(path.join(current, entry.name));
      } else if (entry.isFile()) {
        out.push(path.relative(dir, path.join(current, entry.name)).split(path.sep).join("/"));
      }
    }
  };
  if (existsSync(dir)) visit(dir);
  return out.sort();
}

/**
 * Fichiers versionnés ou qui le seraient au prochain commit
 * (suivis + non suivis non ignorés). Sans dépôt Git, parcourt le projet
 * en excluant les dossiers ignorés.
 */
export function listProjectFiles(): string[] {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (path.resolve(top) !== ROOT) throw new Error("dépôt parent");
    const raw = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return raw
      .split("\0")
      .filter((f) => f && existsSync(path.join(ROOT, f)) && statSync(path.join(ROOT, f)).isFile())
      .sort();
  } catch {
    return walk(ROOT);
  }
}

/** Collecte des erreurs, puis affichage et code de sortie. */
export class Report {
  private readonly name: string;
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  fail(message: string): void {
    this.errors.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }

  ok(message: string): void {
    console.log(`  ✓ ${message}`);
  }

  finish(): void {
    for (const w of this.warnings) console.warn(`  ! ${w}`);
    for (const e of this.errors) console.error(`  ✗ ${e}`);
    if (this.errors.length > 0) {
      console.error(`\n${this.name} : ÉCHEC (${this.errors.length} problème(s)).`);
      process.exit(1);
    }
    console.log(`\n${this.name} : OK.`);
  }
}
