import z from "zod"
import { GameId } from "#api/games/GameId.ts"
import { PlayerId } from "#api/games/PlayerId.ts"
import { GamePlayerActionType } from "#lib/gamePlayerActionType.ts"

type PlayerActionRule = {
  costMoney: number
  rewardMoney: number
  endsGame: boolean
}
export const GAME_PLAYER_ACTION_RULES = {
  [GamePlayerActionType.MAKE_MORE_MONEY]: {
    costMoney: 2,
    rewardMoney: 5,
    endsGame: false,
  },
  [GamePlayerActionType.WIN_THE_GAME]: {
    costMoney: 10,
    rewardMoney: 0,
    endsGame: true,
  },
} as const satisfies Record<GamePlayerActionType, PlayerActionRule>

export const GamePlayerActionTypeSchema = z.enum(GamePlayerActionType)

export type GamePlayerAction = z.infer<typeof GamePlayerActionSchema>
export const GamePlayerActionSchema = z.object({
  gameId: GameId,
  playerId: PlayerId,
  tick: z.number(),
  actionType: GamePlayerActionTypeSchema,
  updatedAt: z.date(),
})
