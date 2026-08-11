import type { ActionDefinition } from "#turn-processing/engine/actions/ActionDefinition.ts"
import { ActionTier } from "#turn-processing/engine/actions/ActionTier.ts"
import { ActionType } from "#turn-processing/engine/actions/ActionType.ts"
import { ResourceType } from "#turn-processing/engine/mechanics/ResourceType.ts"
import { Victory } from "#turn-processing/engine/mechanics/Victory.ts"

export const WinTheGame: ActionDefinition = {
  id: "win-the-game-action",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.EXCEPTIONAL,
  source: "SELF",
  target: "SELF",
  costs: [{ resourceType: ResourceType.MONEY, quantity: 10 }],
  mechanics: [{ mechanicId: Victory.id, resolvedParameters: {} }],
}
