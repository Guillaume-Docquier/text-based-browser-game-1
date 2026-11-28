import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { canAfford } from "#shared/domain/games/credits.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import { BuildingType, type Building } from "./Building.ts"

export const TRADE_CENTER_COST = 30
export type ConstructionOrderId = Branded<"ConstructionOrderId", string>
export const ConstructionOrderIdSchema = z.uuid().transform(branded<ConstructionOrderId>)
export const ConstructionOrderSchema = z.object({
  id: ConstructionOrderIdSchema,
  planetId: PlanetIdSchema,
  site: z.int().nonnegative(),
  type: z.literal(BuildingType.TRADE_CENTER),
  cost: z.number().nonnegative(),
})
export type ConstructionOrder = z.infer<typeof ConstructionOrderSchema>

type ConstructionPlanet = Pick<Planet, "id" | "ownerPlayerId" | "area">
type SiteBuilding = Pick<Building, "type" | "planetId" | "site">

export function hasOwnedCommandCenter(planet: ConstructionPlanet, playerId: PlayerId, buildings: readonly SiteBuilding[]): boolean {
  return (
    planet.ownerPlayerId === playerId &&
    buildings.some((building) => building.planetId === planet.id && building.type === BuildingType.COMMAND_CENTER)
  )
}

export function constructionProblem({
  planet,
  playerId,
  buildings,
  orders,
  available,
  site,
}: {
  planet: ConstructionPlanet | undefined
  playerId: PlayerId
  buildings: readonly SiteBuilding[]
  orders: readonly ConstructionOrder[]
  available: string
  site: number
}): "NO_COMMAND_CENTER" | "CENTER_RESERVED" | "SITE_UNAVAILABLE" | "INSUFFICIENT_CREDITS" | undefined {
  if (planet === undefined || !hasOwnedCommandCenter(planet, playerId, buildings)) {
    return "NO_COMMAND_CENTER"
  }
  if (orders.some((order) => order.planetId === planet.id)) {
    return "CENTER_RESERVED"
  }
  if (
    !Number.isInteger(site) ||
    site < 0 ||
    site >= planet.area ||
    buildings.some((building) => building.planetId === planet.id && building.site === site)
  ) {
    return "SITE_UNAVAILABLE"
  }
  if (!canAfford(available, TRADE_CENTER_COST)) {
    return "INSUFFICIENT_CREDITS"
  }
  return undefined
}
