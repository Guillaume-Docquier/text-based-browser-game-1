import type { XY } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { toOrbitCoordinates } from "#api/shared/OrbitCoordinates.ts"
import type { StarCoordinates } from "#api/shared/StarCoordinates.ts"
import { type planetsTable } from "#lib/db/schema.ts"

/**
 * Planet coordinates go from 00:00:00 to 99:99:49
 * The first 2 segments are the star coordinates
 * The last segment is the orbit coordinates
 */
export type PlanetCoordinates = z.infer<typeof PlanetCoordinates>
export const PlanetCoordinates = z.string() satisfies z.ZodType<(typeof planetsTable.$inferSelect)["coordinates"]>

export function toPlanetCoordinates({
  starCoordinates,
  star,
  planet,
}: {
  starCoordinates: StarCoordinates
  star: XY
  planet: XY
}): PlanetCoordinates {
  return `${starCoordinates}:${toOrbitCoordinates({ star, planet })}`
}
