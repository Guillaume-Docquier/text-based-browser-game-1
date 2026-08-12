import type { ActionDefinition } from "#turn-processing/engine/actions/ActionDefinition.ts"
import { MakeMoreMoney } from "#turn-processing/ruleset/make-more-money.ts"
import { WinTheGame } from "#turn-processing/ruleset/win-the-game.ts"

export type Ruleset = {
  actionDefinitions: Record<string, ActionDefinition>
}

export const Ruleset: Ruleset = {
  actionDefinitions: indexById([MakeMoreMoney, WinTheGame]),
}

function indexById<T extends { id: string }>(array: T[]): Record<string, T> {
  return array.reduce<Record<string, T>>((acc, val) => {
    acc[val.id] = val
    return acc
  }, {})
}
