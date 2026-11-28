import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerColorSchema } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { BuildingSchema } from "shared/domain/world/buildings/Building.ts"
import { ConstructionOrderSchema } from "shared/domain/world/buildings/ConstructionOrder.ts"
import { GalaxySchema } from "shared/domain/world/Galaxy.ts"
import { ShipSchema } from "shared/domain/world/ships/Ship.ts"
import { z } from "zod"

export type PlayerViewPlayer = z.infer<typeof PlayerViewPlayerSchema>
export const PlayerViewPlayerSchema = z.object({
  id: PlayerIdSchema,
  color: PlayerColorSchema,
})

export type PlayerView = z.infer<typeof PlayerViewSchema>
export const PlayerViewSchema = z.object({
  gameId: GameIdSchema,
  player: PlayerViewPlayerSchema.extend({ creditBalance: z.number().nonnegative() }),
  opponents: z.record(PlayerIdSchema, PlayerViewPlayerSchema),
  galaxy: GalaxySchema,
  ships: z.array(
    ShipSchema.extend({ thrust: z.number(), emptyMass: z.number(), cargoSize: z.int().nonnegative(), cargo: z.tuple([]), order: z.null() }),
  ),
  constructionOrders: z.array(ConstructionOrderSchema),
  buildings: z.array(BuildingSchema),
  turn: z.number(),
})
