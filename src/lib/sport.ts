/**
 * Règles de l'univers Sport, sans dépendance à Astro : utilisables aussi par
 * les scripts (check:launch) et les tests.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CourseCalendrier } from "../schemas/sport.ts";

export const MARQUEUR = "À_COMPLÉTER";
export const INTRODUCTION = path.join(process.cwd(), "src", "content", "sport", "introduction.md");

/** Texte de l'introduction, sans l'en-tête (frontmatter) ni les espaces. */
export function texteIntroduction(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
}

/** L'introduction est remplie : du texte, et plus aucun « À_COMPLÉTER ». */
export function introductionRemplie(source: string): boolean {
  const texte = texteIntroduction(source);
  return texte.length > 0 && !texte.includes(MARQUEUR);
}

/** L'univers Sport est publié dès que l'introduction est remplie. */
export function sportPublie(fichier = INTRODUCTION): boolean {
  return existsSync(fichier) && introductionRemplie(readFileSync(fichier, "utf8"));
}

/**
 * Une course est affichée si elle n'est pas en brouillon ; une course
 * d'exemple, seulement en développement local (jamais dans le site publié).
 */
export function courseVisible(course: { draft: boolean; exemple: boolean }, developpement: boolean): boolean {
  if (course.draft) return false;
  return !course.exemple || developpement;
}

/** Date du jour à Lausanne, au format AAAA-MM-JJ. */
export function aujourdhui(maintenant = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    maintenant,
  );
}

/** Courses à venir (aujourd'hui compris), de la plus proche à la plus lointaine. */
export function prochainesCourses(calendrier: CourseCalendrier[], jour = aujourdhui()): CourseCalendrier[] {
  return calendrier.filter((c) => c.date >= jour).sort((a, b) => a.date.localeCompare(b.date));
}

/** Date en toutes lettres : « 1er novembre 2026 », « 15 décembre 2026 ». */
export function dateEnLettres(date: string | Date): string {
  const d = typeof date === "string" ? new Date(`${date}T12:00:00Z`) : date;
  const texte = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return texte.replace(/^1 /, "1er ");
}

/** Date au format AAAA-MM-JJ (attribut datetime). */
export function dateIsoCourte(date: Date): string {
  return date.toISOString().slice(0, 10);
}
