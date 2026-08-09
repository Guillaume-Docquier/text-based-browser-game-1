import { MakeMoreMoney } from "#turn-processing/ruleset/make-more-money.ts"
import { WinTheGame } from "#turn-processing/ruleset/win-the-game.ts"

export const Ruleset = {
  actions: [MakeMoreMoney, WinTheGame],
} as const
