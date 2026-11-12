import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { defineAction, type AuthoredAction } from "../../definitions/defineAction.ts"
import { mechanicRegistry } from "../../mechanics/mechanicRegistry.ts"

function move(
  id: string,
  tier: ActionTier,
  fuel: number,
  speed: number,
): AuthoredAction<{ readonly fleet: "fleet"; readonly planet: "planet" }, typeof mechanicRegistry> {
  return defineAction(mechanicRegistry, {
    id,
    name: "Move Fleet",
    type: ActionType.DIRECTIVE,
    tier,
    targets: { fleet: "fleet", planet: "planet" },
    constraints: [],
    costs: [
      { quantity: 3, resourceType: ResourceType.INFLUENCE },
      { quantity: fuel, resourceType: ResourceType.FUEL },
    ],
    mechanics: [{ use: "moveFleet", bind: { fleet: "fleet", destination: "planet" }, parameters: { speed } }],
  })
}
/**
 * Action target names are independent from the mechanic's local slot names.
 */
export const moveActions = [
  move("MOVE_FLEET_STANDARD", ActionTier.STANDARD, 1, 0.1),
  move("MOVE_FLEET_IMPROVED", ActionTier.IMPROVED, 3, 1),
  move("MOVE_FLEET_EXCEPTIONAL", ActionTier.EXCEPTIONAL, 5, 5),
] as const
