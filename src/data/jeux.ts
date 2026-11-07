/**
 * Jeux favoris, dans l'ordre d'affichage de la page Jeux.
 *
 * Seul « titre » est obligatoire. Les autres champs sont facultatifs :
 * laisse "" (ou retire la ligne) et rien ne s'affiche.
 *   plateforme : "PC", "Nintendo Switch"…
 *   niveau     : niveau, rang ou grade (ex. "Or III")
 *   texte      : une ou deux phrases
 *   image      : nom d'une de TES captures placée dans src/assets/jeux/
 *                (jamais de logo ni de jaquette officielle) + imageAlt
 */
import { favorisSchema } from "../schemas/jeux.ts";

export const favoris = favorisSchema.parse([
  { titre: "The Legend of Zelda: Breath of the Wild" },
  { titre: "The Legend of Zelda: Tears of the Kingdom" },
  { titre: "Project Zomboid" },
  { titre: "Grand Theft Auto V Online" },
  { titre: "Rainbow Six Siege" },
  { titre: "Aniimo" },
]);
