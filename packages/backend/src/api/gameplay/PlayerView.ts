import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerColorSchema } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { BuildingSchema } from "shared/domain/world/buildings/Building.ts"
import { ConstructionOrderSchema } from "shared/domain/world/buildings/ConstructionOrder.ts"
import { PlanetSchema } from "shared/domain/world/planets/Planet.ts"
import { ShipSchema } from "shared/domain/world/ships/Ship.ts"
import { MoveOrderSchema } from "shared/domain/world/ships/travel.ts"
import { StarSchema } from "shared/domain/world/stars/Star.ts"
import { z } from "zod"

export type PlayerViewPlayer = z.infer<typeof PlayerViewPlayerSchema>
export const PlayerViewPlayerSchema = z.object({
  id: PlayerIdSchema,
  color: PlayerColorSchema,
})

const publicPlanet = PlanetSchema.pick({ id: true, name: true, coordinates: true, x: true, y: true })
const VisiblePlanetSchema = z.discriminatedUnion("observation", [
  PlanetSchema.extend({ observation: z.enum(["current", "remembered"]), observedTurn: z.int() }),
  publicPlanet.extend({
    observation: z.literal("unknown"),
    observedTurn: z.null(),
    ownerPlayerId: z.null(),
    biome: z.null(),
    size: z.null(),
    area: z.null(),
    metalProduction: z.null(),
    remainingMetalDeposit: z.null(),
  }),
])
export type PlayerView = z.infer<typeof PlayerViewSchema>
export const PlayerViewSchema = z.object({
  gameId: GameIdSchema,
  availableCredits: z.string(),
  player: PlayerViewPlayerSchema.extend({ creditBalance: z.number().nonnegative(), creditBalanceExact: z.string() }),
  opponents: z.record(PlayerIdSchema, PlayerViewPlayerSchema),
  galaxy: z.object({ systems: z.array(z.object({ star: StarSchema, planets: z.array(VisiblePlanetSchema) })) }),
  ships: z.array(
    ShipSchema.extend({
      thrust: z.number(),
      emptyMass: z.number(),
      cargoSize: z.int().nonnegative(),
      cargo: z.tuple([]),
      order: MoveOrderSchema.nullable(),
      position: z.object({ x: z.number(), y: z.number() }).nullable(),
    }),
  ),
  constructionOrders: z.array(ConstructionOrderSchema),
  buildings: z.array(BuildingSchema),
  turn: z.number(),
})
