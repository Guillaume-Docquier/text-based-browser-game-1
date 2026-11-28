import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { BuildingType } from "shared/domain/world/buildings/Building.ts"
import { ConstructionOrderIdSchema } from "shared/domain/world/buildings/ConstructionOrder.ts"
import { PlanetIdSchema } from "shared/domain/world/planets/PlanetId.ts"
import { z } from "zod"

const target = z.object({ gameId: z.coerce.number().pipe(GameIdSchema), turn: z.int().positive() })
export const ConstructionCommandSchema = z.discriminatedUnion("action", [
  target.extend({
    action: z.literal("submit"),
    planetId: PlanetIdSchema,
    site: z.int().nonnegative(),
    type: z.literal(BuildingType.TRADE_CENTER),
  }),
  target.extend({ action: z.literal("cancel"), orderId: ConstructionOrderIdSchema }),
])
export type ConstructionCommand = z.infer<typeof ConstructionCommandSchema>
