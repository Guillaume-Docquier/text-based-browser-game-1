import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { defineAction, type AuthoredAction } from "../../definitions/defineAction.ts"
import { mechanicRegistry } from "../../mechanics/mechanicRegistry.ts"

type BuildTier = Readonly<{ id: string; tier: ActionTier; influence: number; metal: number; strength: number }>

function build({
  id,
  tier,
  influence,
  metal,
  strength,
}: BuildTier): AuthoredAction<{ readonly planet: "planet" }, typeof mechanicRegistry> {
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
  build({ id: "BUILD_FLEET_STANDARD", tier: ActionTier.STANDARD, influence: 2, metal: 1, strength: 10 }),
  build({ id: "BUILD_FLEET_IMPROVED", tier: ActionTier.IMPROVED, influence: 6, metal: 3, strength: 100 }),
  build({ id: "BUILD_FLEET_EXCEPTIONAL", tier: ActionTier.EXCEPTIONAL, influence: 10, metal: 5, strength: 1000 }),
] as const
