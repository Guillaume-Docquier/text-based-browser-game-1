import { Range } from "@guillaume-docquier/tools-ts"

export type GalaxyCreationSettings = typeof GalaxyCreationSettings

export const GalaxyCreationSettings = {
  GALAXY_DIAMETER_LIGHT_YEARS: 100,
  REGION_SIZE_LIGHT_YEARS: 10,
  GALAXY_SYSTEMS_COUNT: 1_000,
  HOME_WORLD_DISTANCE_LIGHT_YEARS: Range.float({ min: 10, max: 13 }),
  HOME_WORLD_ANGLE_OFFSET_DEGREES: Range.float({ min: -5, max: 5 }),
} as const
