import { indexById } from "#lib/indexById.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { BuildFleetExceptional, BuildFleetImproved, BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"

export const StandardRuleset = Ruleset.create({
  /**
   * Stable id so that it is updated on deploy
   */
  id: "core_standard_v1",
  name: "Standard V1",
  isDefault: true,
  actionDefinitions: indexById([
    GainInfluence,
    WinTheGame,
    GainEnergy,
    GainFuel,
    GainMetal,
    BuildFleetStandard,
    BuildFleetImproved,
    BuildFleetExceptional,
  ]),
  startingResources: {
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  },
})
