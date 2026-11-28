import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { BuildingSchema, BuildingType, type Building } from "#shared/domain/world/buildings/Building.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

export function createBuildingStub({
  planetId,
  site = 0,
  id = v4(),
  type = BuildingType.COMMAND_CENTER,
}: {
  planetId: PlanetId
  site?: number
  id?: string
  type?: BuildingType
}): Building {
  return typedParse(BuildingSchema, { id, planetId, site, type })
}
