import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ShipIdSchema } from "shared/domain/world/ships/Ship.ts"
import { BodyRefSchema } from "shared/domain/world/ships/travel.ts"
import { z } from "zod"
const target = z.object({ gameId: z.coerce.number().pipe(GameIdSchema), turn: z.int().positive() })
export const MoveShipCommandSchema = z.discriminatedUnion("action", [
  target.extend({ action: z.literal("submit"), shipId: ShipIdSchema, destination: BodyRefSchema }),
  target.extend({ action: z.literal("cancel"), orderId: z.uuid() }),
])
export type MoveShipCommand = z.infer<typeof MoveShipCommandSchema>
