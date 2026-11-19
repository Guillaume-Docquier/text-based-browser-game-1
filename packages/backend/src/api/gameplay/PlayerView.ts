import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerColorSchema } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { TurnStatusSchema } from "shared/domain/turns/TurnStatus.ts"
import { GalaxySchema } from "shared/domain/world/Galaxy.ts"
import { z } from "zod"

export type PlayerViewPlayer = z.infer<typeof PlayerViewPlayerSchema>
export const PlayerViewPlayerSchema = z.object({
  id: PlayerIdSchema,
  color: PlayerColorSchema,
  isReady: z.boolean(),
})

export type PlayerView = z.infer<typeof PlayerViewSchema>
export const PlayerViewSchema = z.object({
  gameId: GameIdSchema,
  player: PlayerViewPlayerSchema,
  opponents: z.record(PlayerIdSchema, PlayerViewPlayerSchema),
  galaxy: GalaxySchema,
  turn: z.number(),
  turnStatus: TurnStatusSchema,
  turnEndsAt: z.date(),
})
