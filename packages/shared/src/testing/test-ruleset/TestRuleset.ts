import { indexBy } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import {
  BuildFleetExceptional,
  BuildFleetImproved,
  BuildFleetStandard,
} from "#shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainEnergy } from "#shared/testing/test-ruleset/action-definitions/gain-energy.ts"
import { GainFuel } from "#shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "#shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { WinTheGame } from "#shared/testing/test-ruleset/action-definitions/win-the-game.ts"

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
