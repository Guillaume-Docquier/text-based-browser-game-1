import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ActionDefinitionSchema, type ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { EffectDefinitionSchema, type EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { RulesetSchema, type Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { AttackMoveStandard } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizePlanetStandard } from "#shared/testing/test-ruleset/action-definitions/colonize-planet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"

/** Pregame I5-06 content; independent instances share one renamed definition. */
export function createFleetOperationsRuleset(maximumDistance = 18): Ruleset {
  const definitions = [
    authorFleetOrder({
      base: ColonizePlanetStandard,
      id: "EXPAND",
      name: "Expand",
      influence: 24,
      speed: 9,
      unclaimed: true,
      maximumDistance,
    }),
    authorFleetOrder({
      base: AttackMoveStandard,
      id: "ENGAGE",
      name: "Engage",
      influence: 4,
      speed: 10,
      unclaimed: false,
      maximumDistance,
    }),
  ]
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

type FleetOrderContent = Readonly<{
  base: ActionDefinition
  id: string
  name: string
  influence: number
  speed: number
  unclaimed: boolean
  maximumDistance: number
}>

function authorFleetOrder(content: FleetOrderContent): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    ...content.base,
    id: content.id,
    name: content.name,
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
          ...(content.unclaimed ? [{ type: "UNCLAIMED_PLANET" as const }] : []),
          { type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: content.maximumDistance },
        ],
      },
    },
    costs: content.base.costs
      .filter((cost) => cost.parameters.resourceType === "INFLUENCE")
      .map((cost) => ({ ...cost, parameters: { ...cost.parameters, quantity: content.influence } })),
    effects: content.base.effects.map((effect) => authorFleetEffect(effect, content.speed)),
  })
}

function authorFleetEffect(effect: EffectDefinition, speed: number): EffectDefinition {
  const targets = {
    fleet: { actionTargetTag: "craft", targetType: "FLEET" as const },
    planet: { actionTargetTag: "world", targetType: "PLANET" as const },
  }
  switch (effect.type) {
    case "FLEET_MOVE":
      return typedParse(EffectDefinitionSchema, {
        ...effect,
        targets,
        inputs: { strength: { actionInputTag: "force" } },
        parameters: { speed },
      })
    case "COLONIZE":
      return typedParse(EffectDefinitionSchema, { ...effect, targets, parameters: { requiredStrength: 25 } })
    case "ASSAULT":
      return typedParse(EffectDefinitionSchema, { ...effect, targets })
    default:
      return effect
  }
}
