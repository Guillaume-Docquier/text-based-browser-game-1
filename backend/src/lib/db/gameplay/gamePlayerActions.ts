import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import type { MovementNode } from "#lib/db/gameplay/MovementNode.ts"

/**
 * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
 */
type PlayerActionRule = {
  costMoney: number
  rewardMoney: number
  endsGame: boolean
}

/**
 * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
 */
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
  [GamePlayerActionType.BUILD_UNIT]: {
    costMoney: 1,
    rewardMoney: 0,
    endsGame: false,
  },
} as const satisfies Record<GamePlayerActionType, PlayerActionRule>

/**
 * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
 */
export type GamePlayerAction =
  | { readonly actionType: typeof GamePlayerActionType.MAKE_MORE_MONEY }
  | { readonly actionType: typeof GamePlayerActionType.WIN_THE_GAME }
  | {
      readonly actionType: typeof GamePlayerActionType.BUILD_UNIT
      readonly destination: MovementNode
    }
