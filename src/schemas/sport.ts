import { z } from "astro/zod";

const texte = z.string().trim().min(1);

/** Date au format AAAA-MM-JJ, et date réelle (pas de 31 février). */
export const dateIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue : AAAA-MM-JJ (ex. 2026-12-05)")
  .refine((d) => {
    const date = new Date(`${d}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(d);
  }, "Date inexistante");

/** Une course à venir du calendrier. */
export const courseCalendrierSchema = z.strictObject({
  date: dateIso,
  circuit: texte,
  evenement: texte,
});

export const calendrierSchema = z.array(courseCalendrierSchema);

export type CourseCalendrier = z.output<typeof courseCalendrierSchema>;
