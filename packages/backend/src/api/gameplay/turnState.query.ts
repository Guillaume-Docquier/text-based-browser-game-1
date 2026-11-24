import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"

export type TurnStateQuery = z.infer<typeof TurnStateQuerySchema>
export const TurnStateQuerySchema = z.object({ gameId: GameIdSchema })
