import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { defineAction, type AuthoredAction } from "../../definitions/defineAction.ts"
import { mechanicRegistry } from "../../mechanics/mechanicRegistry.ts"

function build(
  id: string,
  tier: ActionTier,
  influence: number,
  metal: number,
  strength: number,
): AuthoredAction<{ readonly planet: "planet" }, typeof mechanicRegistry> {
  return defineAction(mechanicRegistry, {
    id,
    name: "Build Fleet",
    type: ActionType.DIRECTIVE,
    tier,
    targets: { planet: "planet" },
    constraints: [],
    costs: [
      { quantity: influence, resourceType: ResourceType.INFLUENCE },
      { quantity: metal, resourceType: ResourceType.METAL },
    ],
    mechanics: [{ use: "buildFleet", bind: { planet: "planet" }, parameters: { strength } }],
  })
}
/**
 * Ownership belongs to the mechanic, so actions need not repeat it.
 */
export const buildActions = [
  build("BUILD_FLEET_STANDARD", ActionTier.STANDARD, 2, 1, 10),
  build("BUILD_FLEET_IMPROVED", ActionTier.IMPROVED, 6, 3, 100),
  build("BUILD_FLEET_EXCEPTIONAL", ActionTier.EXCEPTIONAL, 10, 5, 1000),
] as const
