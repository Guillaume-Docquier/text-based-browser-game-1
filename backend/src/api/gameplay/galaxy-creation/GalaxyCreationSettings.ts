import { Angle, Distance, UnitOfAngle, UnitOfDistance } from "@guillaume-docquier/tools-ts"

/**
 * Eventually, players will be able to customize this.
 */
export type GalaxyCreationSettings = typeof GalaxyCreationSettings

/**
 * The default galaxy creation settings.
 */
export const GalaxyCreationSettings = {
  /**
   * How big the generated galaxy should be.
   */
  GALAXY_DIAMETER_LIGHT_YEARS: 100,

  /**
   * How big each region is, should be a factor of GALAXY_DIAMETER_LIGHT_YEARS.
   * Regions are squares.
   */
  REGION_SIZE_LIGHT_YEARS: 10,

  /**
   * How many star systems to aim for.
   * It might create a little bit more or less systems than this.
   */
  GALAXY_SYSTEMS_COUNT: 1_000,

  /**
   * Home worlds will be spread out around the galaxy center.
   * This setting controls how far away the home worlds are scattered.
   */
  HOME_WORLD_DISTANCE: Distance.create(10, UnitOfDistance.LIGHT_YEARS),

  /**
   * Used to put some noise in home world position
   */
  HOME_WORLD_DISTANCE_STANDARD_DEVIATION: Distance.create(5, UnitOfDistance.LIGHT_YEARS),

  /**
   * Used to put some noise in home world position
   */
  HOME_WORLD_ANGLE_STANDARD_DEVIATION: Angle.create(10, UnitOfAngle.DEGREES),
} as const
