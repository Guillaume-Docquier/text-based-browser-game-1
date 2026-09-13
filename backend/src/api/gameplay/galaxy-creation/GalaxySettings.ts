const radius = 50

export const GalaxySettings = {
  GALAXY_SIZE_LIGHT_YEARS: radius * 2,
  GALAXY_RADIUS_LIGHT_YEARS: radius,
  REGION_SIZE_LIGHT_YEARS: 10,
  GALAXY_ORIGIN: { x: radius, y: radius },
  GALAXY_SYSTEMS_COUNT: 1_000,
} as const
