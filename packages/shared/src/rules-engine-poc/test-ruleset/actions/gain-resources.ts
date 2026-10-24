import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { defineAction } from "../../definitions/defineAction.ts"
import { mechanicRegistry } from "../../mechanics/mechanicRegistry.ts"

/**
 * The four resource actions in the current Test Ruleset, independently authored.
 */
export const resourceActions = [
  defineAction(mechanicRegistry, {
    id: "GAIN_INFLUENCE",
    name: "Political Campaign",
    type: ActionType.AGENDA,
    tier: ActionTier.BASIC,
    targets: {},
    constraints: [],
    costs: [],
    mechanics: [{ use: "gainResources", bind: {}, parameters: { quantity: 5, resourceType: ResourceType.INFLUENCE } }],
  }),
  defineAction(mechanicRegistry, {
    id: "GAIN_METAL",
    name: "Extract Metal",
    type: ActionType.DIRECTIVE,
    tier: ActionTier.STANDARD,
    targets: {},
    constraints: [],
    costs: [{ quantity: 1, resourceType: ResourceType.INFLUENCE }],
    mechanics: [{ use: "gainResources", bind: {}, parameters: { quantity: 5, resourceType: ResourceType.METAL } }],
  }),
  defineAction(mechanicRegistry, {
    id: "GAIN_FUEL",
    name: "Refine Fuel",
    type: ActionType.DIRECTIVE,
    tier: ActionTier.ADVANCED,
    targets: {},
    constraints: [],
    costs: [
      { quantity: 2, resourceType: ResourceType.INFLUENCE },
      { quantity: 2, resourceType: ResourceType.METAL },
    ],
    mechanics: [{ use: "gainResources", bind: {}, parameters: { quantity: 5, resourceType: ResourceType.FUEL } }],
  }),
  defineAction(mechanicRegistry, {
    id: "GAIN_ENERGY",
    name: "Generate Power",
    type: ActionType.DIRECTIVE,
    tier: ActionTier.IMPROVED,
    targets: {},
    constraints: [],
    costs: [
      { quantity: 3, resourceType: ResourceType.INFLUENCE },
      { quantity: 1, resourceType: ResourceType.FUEL },
    ],
    mechanics: [{ use: "gainResources", bind: {}, parameters: { quantity: 5, resourceType: ResourceType.ENERGY } }],
  }),
] as const
