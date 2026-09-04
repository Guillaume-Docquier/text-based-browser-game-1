import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { RulesetId, type Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { indexById } from "#lib/rulesets/indexById.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"

export const StandardRuleset: Ruleset = {
  /**
   * Stable id so that it is updated on deploy
   */
  id: RulesetId.parse("core_standard_v1"),
  name: "Standard V1",
  isDefault: true,
  actionDefinitions: indexById([GainInfluence, WinTheGame, GainEnergy, GainFuel, GainMetal]),
  startingResources: {
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  },
}
