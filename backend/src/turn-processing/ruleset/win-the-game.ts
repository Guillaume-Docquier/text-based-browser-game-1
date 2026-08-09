import type { ActionDefinition } from "#turn-processing/engine/action/ActionDefinition.ts"
import { ActionTier } from "#turn-processing/engine/action/ActionTier.ts"
import { ActionType } from "#turn-processing/engine/action/ActionType.ts"
import { Victory } from "#turn-processing/engine/effects/mechanics/Victory.ts"
import { ResourceType } from "#turn-processing/engine/effects/ResourceType.ts"

export const WinTheGame: ActionDefinition = {
  id: "",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.EXCEPTIONAL,
  source: "SELF",
  target: "SELF",
  costs: [{ resourceType: ResourceType.MONEY, quantity: 10 }],
  effects: [{ mechanicId: Victory.id, resolvedParameters: {} }],
}
