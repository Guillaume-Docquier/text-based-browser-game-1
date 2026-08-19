import z from "zod"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { ActionType } from "#lib/db/gameplay/actionType.ts"

export const ActionTypeSchema = z.enum(ActionType)

export type ActionDto = z.infer<typeof ActionDto>
export const ActionDto = z.object({
  gameId: GameId,
  playerId: PlayerId,
  turn: z.number(),
  actionType: ActionTypeSchema,
  updatedAt: z.date(),
})
