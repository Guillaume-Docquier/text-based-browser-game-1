import { indexBy } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "game-rules/ruleset/effect-definitions/ResourceType.ts"
import { Ruleset } from "game-rules/ruleset/Ruleset.ts"
import { BuildFleetExceptional, BuildFleetImproved, BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"

const ACTION_DEFINITIONS = [
  GainInfluence,
  WinTheGame,
  GainEnergy,
  GainFuel,
  GainMetal,
  BuildFleetStandard,
  BuildFleetImproved,
  BuildFleetExceptional,
  MoveFleetStandard,
  MoveFleetImproved,
  MoveFleetExceptional,
]

export const StandardRuleset = Ruleset.create({
  /**
   * Stable id so that it is updated on deploy
   */
  id: "core_standard_v1",
  name: "Standard V1",
  isDefault: true,
  actionDefinitions: indexBy("id", ACTION_DEFINITIONS),
  actionPool: ACTION_DEFINITIONS.map((actionDefinition) => ({
    id: `${actionDefinition.id}_1`,
    actionDefinitionId: actionDefinition.id,
  })),
  startingResources: {
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  },
})
