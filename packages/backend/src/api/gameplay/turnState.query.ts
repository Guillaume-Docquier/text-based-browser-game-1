import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export const TurnStateQuerySchema = z.object({ gameId: GameIdSchema })
export type TurnStateQuery = z.infer<typeof TurnStateQuerySchema>
