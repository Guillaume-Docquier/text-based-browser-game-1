import z from "zod"
import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GamePlayerActionType = Enumify<typeof GamePlayerActionType>
export const GamePlayerActionType = {
  MAKE_MORE_MONEY: "MAKE_MORE_MONEY",
  WIN_THE_GAME: "WIN_THE_GAME",
} as const

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
  gameId: z.number(),
  playerId: z.number(),
  tick: z.number(),
  actionType: GamePlayerActionTypeSchema,
  updatedAt: z.date(),
})
