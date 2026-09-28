import { indexBy } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "game-rules/ruleset/effect-definitions/ResourceType.ts"
import { Ruleset } from "game-rules/ruleset/Ruleset.ts"
import { BuildFleetExceptional, BuildFleetImproved, BuildFleetStandard } from "game-rules/test-ruleset/action-definitions/build-fleet.ts"
import { GainEnergy } from "game-rules/test-ruleset/action-definitions/gain-energy.ts"
import { GainFuel } from "game-rules/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "game-rules/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "game-rules/test-ruleset/action-definitions/gain-metal.ts"
import { WinTheGame } from "game-rules/test-ruleset/action-definitions/win-the-game.ts"

const ACTION_DEFINITIONS = [
  GainInfluence,
  WinTheGame,
  GainEnergy,
  GainFuel,
  GainMetal,
  BuildFleetStandard,
  BuildFleetImproved,
  BuildFleetExceptional,
]

export const TestRuleset = Ruleset.create({
  id: "test_default",
  name: "Test",
  isDefault: false,
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
