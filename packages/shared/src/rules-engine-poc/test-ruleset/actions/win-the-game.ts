import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { defineAction } from "../../definitions/defineAction.ts"
import { mechanicRegistry } from "../../mechanics/mechanicRegistry.ts"

/**
 * Matches the existing placeholder victory action.
 */
export const winAction = defineAction(mechanicRegistry, {
  id: "WIN_THE_GAME",
  name: "Win The Game",
  type: ActionType.PROGRAM,
  tier: ActionTier.EXCEPTIONAL,
  targets: {},
  constraints: [],
  costs: [
    { quantity: 10, resourceType: ResourceType.INFLUENCE },
    { quantity: 5, resourceType: ResourceType.METAL },
    { quantity: 5, resourceType: ResourceType.ENERGY },
    { quantity: 5, resourceType: ResourceType.FUEL },
  ],
  mechanics: [{ use: "winGame", bind: {}, parameters: {} }],
})
