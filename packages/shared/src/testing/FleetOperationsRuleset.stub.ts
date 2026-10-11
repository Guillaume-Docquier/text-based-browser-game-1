import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { RulesetSchema, type Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { AttackMoveStandard } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizePlanetStandard } from "#shared/testing/test-ruleset/action-definitions/colonize-planet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"

/** Pregame I5-06 content; independent instances share one renamed definition. */
export function createFleetOperationsRuleset(maximumDistance = 18): Ruleset {
  const definitions = [ColonizePlanetStandard, AttackMoveStandard].map((base, index) =>
    typedParse(ActionDefinitionSchema, {
      ...base,
      id: index === 0 ? "EXPAND" : "ENGAGE",
      name: index === 0 ? "Expand" : "Engage",
      tier: "BASIC",
      inputs: { force: { type: "FLEET_STRENGTH", fleetTargetTag: "craft" } },
      targets: {
        craft: {
          targetType: "FLEET",
          constraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }, { type: "STATIONARY_FLEET" }],
        },
        world: {
          targetType: "PLANET",
          constraints: [
            ...(index === 0 ? [{ type: "UNCLAIMED_PLANET" as const }] : []),
            { type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance },
          ],
        },
      },
      costs: base.costs
        .filter((cost) => cost.parameters.resourceType === "INFLUENCE")
        .map((cost) => ({ ...cost, parameters: { ...cost.parameters, quantity: index === 0 ? 24 : 4 } })),
      effects: base.effects.map((effect) => {
        if (effect.type !== "FLEET_MOVE" && effect.type !== "ASSAULT" && effect.type !== "COLONIZE") return effect
        const targets = {
          fleet: { actionTargetTag: "craft", targetType: "FLEET" as const },
          planet: { actionTargetTag: "world", targetType: "PLANET" as const },
        }
        if (effect.type === "FLEET_MOVE")
          return { ...effect, targets, inputs: { strength: { actionInputTag: "force" } }, parameters: { speed: index === 0 ? 9 : 10 } }
        if (effect.type === "COLONIZE") return { ...effect, targets, parameters: { requiredStrength: 25 } }
        return { ...effect, targets }
      }),
    }),
  )
  const replacements = new Map([
    [ColonizePlanetStandard.id, definitions[0]],
    [AttackMoveStandard.id, definitions[1]],
  ])
  return typedParse(RulesetSchema, {
    ...TestRuleset,
    id: `fleet-operations-${maximumDistance}`,
    name: `Fleet Operations ${maximumDistance}`,
    actionDefinitions: Object.fromEntries(
      Object.values(TestRuleset.actionDefinitions).map((definition) => {
        const replacement = replacements.get(definition.id)
        return replacement === undefined ? [definition.id, definition] : [replacement.id, replacement]
      }),
    ),
    actionPool: TestRuleset.actionPool.map((entry) => {
      const replacement = replacements.get(entry.actionDefinitionId)
      return replacement === undefined
        ? entry
        : { id: entry.id.replace(entry.actionDefinitionId, replacement.id), actionDefinitionId: replacement.id }
    }),
  })
}
