import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"
import { MakeMoreMoney } from "#lib/ruleset/action-definitions/make-more-money.ts"
import { WinTheGame } from "#lib/ruleset/action-definitions/win-the-game.ts"

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
