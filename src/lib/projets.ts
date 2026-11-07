import { getCollection, type CollectionEntry } from "astro:content";

export type Projet = CollectionEntry<"projets">;

/** Projets publiés (draft: false), triés par `order`. */
export async function getProjetsPublies(): Promise<Projet[]> {
  const projets = await getCollection("projets", ({ data }) => data.draft === false);
  projets.sort((a, b) => a.data.order - b.data.order);

  const vus = new Map<number, string>();
  for (const projet of projets) {
    const autre = vus.get(projet.data.order);
    if (autre) {
      throw new Error(`Projets « ${autre} » et « ${projet.id} » : même valeur « order » (${projet.data.order}).`);
    }
    vus.set(projet.data.order, projet.id);
  }
  return projets;
}

/** Numéro unique du site, sur deux chiffres : « 01 », « 02 »… (projets, univers, jeux). */
export function rang(index: number): string {
  return String(index + 1).padStart(2, "0");
}
