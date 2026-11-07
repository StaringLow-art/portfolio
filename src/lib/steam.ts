/**
 * Lecture des données Steam pendant la génération du site (jamais dans le
 * navigateur). Fichier absent ou invalide → null : la section est masquée.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { steamDataSchema, type SteamData } from "../schemas/steam";

export const STEAM_DATA_PATH = path.join(process.cwd(), ".steam", "steam.json");

export function lireSteam(): SteamData | null {
  if (!existsSync(STEAM_DATA_PATH)) return null;
  try {
    const parsed = steamDataSchema.safeParse(JSON.parse(readFileSync(STEAM_DATA_PATH, "utf8")));
    if (parsed.success) return parsed.data;
    console.warn("Données Steam invalides : section masquée.");
  } catch {
    console.warn("Données Steam illisibles : section masquée.");
  }
  return null;
}

/** Durée lisible : « 45 min », « 12 h », « 1 234 h ». */
export function duree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${new Intl.NumberFormat("fr-CH").format(Math.round(minutes / 60))} h`;
}

/** Date lisible : « 6 novembre 2026 ». */
export function dateLongue(iso: string): string {
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" }).format(
    new Date(iso),
  );
}
