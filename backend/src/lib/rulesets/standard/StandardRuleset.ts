import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { indexById } from "#lib/rulesets/indexById.ts"
import { MakeMoreMoney } from "#lib/rulesets/standard/action-definitions/make-more-money.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"

export const StandardRuleset: Ruleset = {
  name: "Standard Ruleset",
  actionDefinitions: indexById([MakeMoreMoney, WinTheGame]),
}
