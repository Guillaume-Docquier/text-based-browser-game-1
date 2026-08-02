import z from "zod"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { ActionType } from "#lib/db/gameplay/actionType.ts"

type PlayerActionRule = {
  costMoney: number
  rewardMoney: number
  endsGame: boolean
}
export const ACTION_RULES = {
  [ActionType.MAKE_MORE_MONEY]: {
    costMoney: 2,
    rewardMoney: 5,
    endsGame: false,
  },
  [ActionType.WIN_THE_GAME]: {
    costMoney: 10,
    rewardMoney: 0,
    endsGame: true,
  },
} as const satisfies Record<ActionType, PlayerActionRule>

export const ActionTypeSchema = z.enum(ActionType)

export type ActionDto = z.infer<typeof ActionDto>
export const ActionDto = z.object({
  gameId: GameId,
  playerId: PlayerId,
  turn: z.number(),
  actionType: ActionTypeSchema,
  updatedAt: z.date(),
})
