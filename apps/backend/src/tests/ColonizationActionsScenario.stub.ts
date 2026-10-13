import { Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { RulesetSchema, type Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import type { Fleet } from "shared/domain/world/fleets/Fleet.ts"
import type { Planet } from "shared/domain/world/planets/Planet.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { ColonizePlanetStandard, ColonizeStationedPlanetStandard } from "shared/testing/test-ruleset/action-definitions/colonize-planet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { createCombatActionsScenario } from "#tests/CombatActionsScenario.stub.ts"
import { submitFleetOrder } from "#tests/submitFleetOrder.ts"

/** Public P4-01 funding: two normal Campaigns after both sides have built40. */
export async function createColonizationActionsScenario(options: Parameters<typeof createCombatActionsScenario>[0]): Promise<
  Awaited<ReturnType<typeof createCombatActionsScenario>> & {
    before: Awaited<ReturnType<Awaited<ReturnType<typeof createCombatActionsScenario>>["attacker"]["view"]>>
    destination: Planet
  }
> {
  const fixture = await createCombatActionsScenario({ ...options, defenderBuildThroughTurn: 5 })
  for (let turn = 6; turn <= 7; turn++) {
    await fixture.attacker.submitDefinition(GainInfluence.id)
    await fixture.defender.submitDefinition(GainInfluence.id)
    const outcome = await fixture.attacker.endTurn()
    Assert.isTrue(outcome === "processed")
  }
  const before = await fixture.attacker.view()
  const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "35:35:40")
  Assert.isDefined(destination)
  return { ...fixture, destination, before }
}

/** P4-04 reaches stationary50 at the unclaimed generated target through ordinary Attack movement. */
export async function createStationaryColonizationActionsScenario(options: Parameters<typeof createCombatActionsScenario>[0]): Promise<
  Awaited<ReturnType<typeof createCombatActionsScenario>> & {
    before: Awaited<ReturnType<Awaited<ReturnType<typeof createCombatActionsScenario>>["attacker"]["view"]>>
    destination: Planet
    sibling: Planet
    source: Fleet
  }
> {
  const fixture = await createCombatActionsScenario({ ...options, defenderBuildThroughTurn: 5 })
  const { attacker } = fixture
  const view = await attacker.view()
  const home = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === view.player.id)
  const destination = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "35:35:40")
  const sibling = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "35:35:30")
  Assert.isDefined(home)
  Assert.isDefined(destination)
  Assert.isDefined(sibling)
  await attacker.submitDefinition(BuildFleetStandard.id, { planet: home.id })
  await attacker.submitDefinition(GainInfluence.id)
  Assert.isTrue((await attacker.endTurn()) === "processed")
  for (let turn = 7; turn <= 8; turn++) {
    await attacker.submitDefinition(GainInfluence.id)
    Assert.isTrue((await attacker.endTurn()) === "processed")
  }
  const built = await attacker.view()
  const departureSource = built.fleets.find((fleet) => fleet.ownerPlayerId === built.player.id && fleet.originPlanetId === home.id)
  Assert.isDefined(departureSource)
  await submitFleetOrder({
    side: attacker,
    actionId: "ATTACK_MOVE_STANDARD_1",
    source: departureSource.id,
    destination: destination.id,
    amount: 50,
  })
  Assert.isTrue((await attacker.endTurn()) === "processed")
  Assert.isTrue((await attacker.endTurn()) === "processed")
  await attacker.submitDefinition(GainInfluence.id)
  await attacker.submitDefinition(GainFuel.id)
  Assert.isTrue((await attacker.endTurn()) === "processed")
  const before = await attacker.view()
  const source = before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id && fleet.originPlanetId === destination.id)
  Assert.isDefined(source)
  return { ...fixture, before, destination, sibling, source }
}

/** Content authoring before creation; renamed mappings and one configured25 requirement. */
export function createConfiguredColonizationRuleset({
  assault = false,
  requiredStrength = 25,
}: { assault?: boolean; requiredStrength?: number } = {}): Ruleset {
  const definitions = [ColonizePlanetStandard, ColonizeStationedPlanetStandard].map((base, index) =>
    typedParse(ActionDefinitionSchema, {
      ...base,
      id: index === 0 ? "EXPAND" : "ESTABLISH",
      name: index === 0 ? "Expand" : "Establish",
      tier: "BASIC",
      inputs: index === 0 ? { force: { type: "FLEET_STRENGTH", fleetTargetTag: "craft" } } : {},
      targets: {
        craft: {
          targetType: "FLEET",
          constraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }, { type: "STATIONARY_FLEET" }],
        },
        world: {
          targetType: "PLANET",
          constraints:
            index === 0
              ? [{ type: "UNCLAIMED_PLANET" }, { type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: 25 }]
              : [{ type: "UNCLAIMED_PLANET" }, { type: "AT_FLEET_PLANET", fleetTargetTag: "craft" }],
        },
      },
      effects: [
        ...base.effects.map((effect) =>
          effect.type === "COLONIZE"
            ? {
                ...effect,
                targets: {
                  fleet: { actionTargetTag: "craft", targetType: "FLEET" as const },
                  planet: { actionTargetTag: "world", targetType: "PLANET" as const },
                },
                parameters: { requiredStrength },
              }
            : effect.type === "FLEET_MOVE"
              ? {
                  ...effect,
                  targets: {
                    fleet: { actionTargetTag: "craft", targetType: "FLEET" as const },
                    planet: { actionTargetTag: "world", targetType: "PLANET" as const },
                  },
                  inputs: { strength: { actionInputTag: "force" } },
                }
              : effect,
        ),
        ...(assault && index === 0
          ? [
              {
                type: "ASSAULT" as const,
                targets: {
                  fleet: { actionTargetTag: "craft", targetType: "FLEET" as const },
                  planet: { actionTargetTag: "world", targetType: "PLANET" as const },
                },
                parameters: {},
              },
            ]
          : []),
      ],
    }),
  )
  return typedParse(RulesetSchema, {
    ...TestRuleset,
    id: assault ? "composed-colonization" : "alternate-colonization",
    name: "Alternate Colonization",
    actionDefinitions: {
      ...TestRuleset.actionDefinitions,
      ...Object.fromEntries(definitions.map((definition) => [definition.id, definition])),
    },
    actionPool: [
      ...TestRuleset.actionPool,
      ...definitions.map((definition) => ({ id: `${definition.id}_one`, actionDefinitionId: definition.id })),
    ],
  })
}
