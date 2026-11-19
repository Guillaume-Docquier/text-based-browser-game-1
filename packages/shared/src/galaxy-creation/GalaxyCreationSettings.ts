import { Angle, Distance, UnitOfAngle, UnitOfDistance } from "@guillaume-docquier/tools-ts"

export type GalaxyCreationSettings = typeof GalaxyCreationSettings

export const GalaxyCreationSettings = {
  GALAXY_DIAMETER_LIGHT_YEARS: 100,
  REGION_SIZE_LIGHT_YEARS: 10,
  GALAXY_SYSTEMS_COUNT: 1_000,
  HOME_WORLD_DISTANCE: Distance.create(10, UnitOfDistance.LIGHT_YEARS),
  HOME_WORLD_DISTANCE_STANDARD_DEVIATION: Distance.create(5, UnitOfDistance.LIGHT_YEARS),
  HOME_WORLD_ANGLE_STANDARD_DEVIATION: Angle.create(10, UnitOfAngle.DEGREES),
} as const
