import type * as ApiTypes from "@api-types"

export const RANGE_SETTING_LABELS = {
  nbPlanets: {
    label: "Planets",
    description: "Total planets generated in the star system.",
  },
  planetDensity: {
    label: "Planet density",
    description: "Share of available sectors populated by planets.",
  },
  nbMoonsPerPlanet: {
    label: "Moons per planet",
    description: "Possible number of moons generated around each planet.",
  },
  nbAsteroidBelts: {
    label: "Asteroid belts",
    description: "Possible number of orbits dedicated to asteroid belts.",
  },
  nbAsteroidsPerSector: {
    label: "Asteroids per sector",
    description: "Possible number of asteroids in each belt sector.",
  },
} satisfies Record<ApiTypes.RangeSettingKey, { label: string; description: string }>
