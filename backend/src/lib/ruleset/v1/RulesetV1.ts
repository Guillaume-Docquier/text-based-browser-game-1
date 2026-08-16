import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import { indexById } from "#lib/ruleset/indexById.ts"
import { MakeMoreMoney } from "#lib/ruleset/v1/action-definitions/make-more-money.ts"
import { WinTheGame } from "#lib/ruleset/v1/action-definitions/win-the-game.ts"

export const RulesetV1: Ruleset = {
  actionDefinitions: indexById([MakeMoreMoney, WinTheGame]),
}
