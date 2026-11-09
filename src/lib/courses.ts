import { getCollection, type CollectionEntry } from "astro:content";
import { courseVisible, sportPublie } from "./sport";

export type Course = CollectionEntry<"courses">;

/**
 * Courses publiées, de la plus récente à la plus ancienne.
 * - aucune tant que l'univers Sport est masqué (introduction vide) ;
 * - jamais les brouillons (draft: true) ;
 * - les courses d'exemple (exemple: true) seulement en développement local
 *   (npm run dev) : jamais dans le build de production ni en ligne.
 */
export async function getCoursesPubliees(): Promise<Course[]> {
  if (!sportPublie()) return [];
  const courses = await getCollection("courses", ({ data }) => courseVisible(data, import.meta.env.DEV));
  return courses.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.data.titre.localeCompare(b.data.titre, "fr"));
}
