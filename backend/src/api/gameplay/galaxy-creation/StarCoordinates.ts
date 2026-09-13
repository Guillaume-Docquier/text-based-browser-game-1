import type { XY } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { GalaxyCreationSettings } from "#api/gameplay/galaxy-creation/GalaxyCreationSettings.ts"
import type { starsTable } from "#lib/db/schema.ts"

/**
 * Star coordinates go from 00:00 to 99:99
 * The first segment is for the region (<ROW><COL>)
 * The second segment is for the cell in the region (<ROW><COL>)
 */
export type StarCoordinates = z.infer<typeof StarCoordinatesSchema>
export const StarCoordinatesSchema = z.string() satisfies z.ZodType<(typeof starsTable.$inferSelect)["coordinates"]>

/**
 * Star coordinates go from 00:00 to 99:99
 * The first segment is for the region (<ROW><COL>)
 * The second segment is for the cell in the region (<ROW><COL>)
 */
export function toStarCoordinates({ x, y }: XY): StarCoordinates {
  const row = Math.floor(y)
  const column = Math.floor(x)
  const regionRow = Math.floor(row / GalaxyCreationSettings.REGION_SIZE_LIGHT_YEARS)
  const regionColumn = Math.floor(column / GalaxyCreationSettings.REGION_SIZE_LIGHT_YEARS)
  const starRow = row % GalaxyCreationSettings.REGION_SIZE_LIGHT_YEARS
  const starColumn = column % GalaxyCreationSettings.REGION_SIZE_LIGHT_YEARS

  return `${regionRow}${regionColumn}:${starRow}${starColumn}`
}
