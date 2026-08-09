import type { XY } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { GalaxySettings } from "#api/shared/GalaxySettings.ts"
import { type starsTable } from "#lib/db/schema.ts"

/**
 * Star coordinates go from 00:00 to 99:99
 * The first segment is for the region (<ROW><COL>)
 * The second segment is for the cell in the region (<ROW><COL>)
 */
export type StarCoordinates = z.infer<typeof StarCoordinates>
export const StarCoordinates = z.string() satisfies z.ZodType<(typeof starsTable.$inferSelect)["coordinates"]>

/**
 * Star coordinates go from 00:00 to 99:99
 * The first segment is for the region (<ROW><COL>)
 * The second segment is for the cell in the region (<ROW><COL>)
 */
export function toStarCoordinates({ x, y }: XY): StarCoordinates {
  const row = Math.floor(y)
  const column = Math.floor(x)
  const regionRow = Math.floor(row / GalaxySettings.REGION_SIZE_LIGHT_YEARS)
  const regionColumn = Math.floor(column / GalaxySettings.REGION_SIZE_LIGHT_YEARS)
  const starRow = row % GalaxySettings.REGION_SIZE_LIGHT_YEARS
  const starColumn = column % GalaxySettings.REGION_SIZE_LIGHT_YEARS

  return `${regionRow}${regionColumn}:${starRow}${starColumn}`
}
