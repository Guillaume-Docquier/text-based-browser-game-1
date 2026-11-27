import type { Rng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import type { Star } from "#shared/domain/world/stars/Star.ts"
import { StarIdSchema } from "#shared/domain/world/stars/StarId.ts"
import { generateName } from "#shared/galaxy-creation/attributes/generateName.ts"
import { toStarCoordinates } from "#shared/galaxy-creation/attributes/toStarCoordinates.ts"
import type { StarTopology } from "#shared/galaxy-creation/topology/starTopologyGenerator.ts"

export function generateStarAttributes(star: StarTopology, starNumber: number, rng: Rng): Star {
  return {
    ...star,
    id: typedParse(StarIdSchema, v5(`star:${starNumber}`, v5.URL)),
    name: generateName("star", rng),
    coordinates: toStarCoordinates(star),
  }
}
