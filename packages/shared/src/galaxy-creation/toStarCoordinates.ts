import type { XY } from "@guillaume-docquier/tools-ts"
import type { StarCoordinates } from "#shared/domain/world/stars/StarCoordinates.ts"
import { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"

/**
 * Converts a light-year position to the existing region and cell coordinate string.
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
