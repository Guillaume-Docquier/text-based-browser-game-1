import { Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { TestRuleset as CurrentRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import { compileRuleset } from "../compiler/compileRuleset.ts"
import type { InvocationDefinition } from "../definitions/ActionDefinition.ts"
import { executeActions } from "../runtime/executeActions.ts"
import { TestRuleset } from "../test-ruleset/TestRuleset.ts"
import { createScenario, extractSuccess, submit, type Scenario } from "./createScenario.stub.ts"

function normalizedMechanic(effect: EffectDefinition): InvocationDefinition {
  switch (effect.type) {
    case "RESOURCE_GAIN":
      return { use: "gainResources", bind: {}, parameters: effect.parameters }
    case "RESOURCE_LOSS":
      return { use: "spendResources", bind: {}, parameters: effect.parameters }
    case "FLEET_BUILD":
      return { use: "buildFleet", bind: { planet: effect.targets.planet.actionTargetTag }, parameters: effect.parameters }
    case "FLEET_MOVE":
      return {
        use: "moveFleet",
        bind: {
          fleet: effect.targets.fleet.actionTargetTag,
          destination: effect.targets.planet.actionTargetTag,
        },
        parameters: effect.parameters,
      }
    case "VICTORY":
      return { use: "winGame", bind: {}, parameters: {} }
  }
}
function domainFleets(fleets: Readonly<Record<string, ResolutionFleet>>): Fleet[] {
  return Object.values(fleets)
    .map(({ arrivedAtTick: _tick, ...fleet }) => fleet)
    .sort((a, b) => a.id.localeCompare(b.id))
}

function selectedForAction(id: string, scenario: Scenario): Readonly<Record<string, string>> {
  if (id.startsWith("BUILD_FLEET")) return { planet: scenario.home.id }
  if (id.startsWith("MOVE_FLEET")) return { fleet: scenario.fleetA.id, planet: scenario.destination.id }
  return {}
}
function createBuildScenario(): Scenario {
  const scenario = createScenario()
  return { ...scenario, state: { ...scenario.state, fleets: {} } }
}
function createMergeScenario(): Scenario {
  const scenario = createScenario()
  scenario.fleetB.originPlanetId = scenario.destination.id
  return scenario
}
function createContinuingScenario(): Scenario {
  const scenario = createScenario()
  scenario.fleetA.destinationPlanetId = scenario.destination.id
  scenario.fleetA.distanceToEnd = typedParse(NonNegativeNumberSchema, 4.9)
  return scenario
}

describe("comparison with current Test Ruleset", () => {
  it("should match all action metadata, effective constraints, costs, parameters and bindings", () => {
    // Arrange
    const compiled = extractSuccess(compileRuleset(JSON.parse(JSON.stringify(TestRuleset))))
    const currentActions = Object.values(CurrentRuleset.actionDefinitions)
    // Act
    const actual = Array.from(compiled.actions.values()).map((action) => ({
      id: action.definition.id,
      name: action.definition.name,
      type: action.definition.type,
      tier: action.definition.tier,
      targets: action.definition.targets,
      constraints: action.constraints,
      costs: action.definition.costs,
      mechanics: action.definition.mechanics,
    }))
    const expected = currentActions.map((action) => ({
      id: action.id,
      name: action.name,
      type: action.type,
      tier: action.tier,
      targets: Object.fromEntries(Object.entries(action.targets).map(([name, target]) => [name, target.targetType.toLowerCase()])),
      constraints: Object.entries(action.targets).flatMap(([name, target]) =>
        target.constraints.map(() => ({
          kind: "ownedByActor",
          target: { name, kind: target.targetType.toLowerCase() },
        })),
      ),
      costs: action.costs.map((cost) => cost.parameters),
      mechanics: action.effects.map(normalizedMechanic),
    }))
    // Assert
    expect(actual).toStrictEqual(expected)
    expect(compiled.definition.actionPool).toStrictEqual(CurrentRuleset.actionPool)
    expect(compiled.definition.startingResources).toStrictEqual(CurrentRuleset.startingResources)
  })

  it.each(Object.values(CurrentRuleset.actionDefinitions))("should match execution state for $id", (action) => {
    // Arrange
    const scenario = createScenario()
    const { state, actor } = scenario
    const selected = selectedForAction(action.id, scenario)
    const submissions = [submit(action.id, actor.id, selected)]
    const currentInput = createTurnStateStub({ ...structuredClone(state), submittedActions: submissions })
    const compiled = extractSuccess(compileRuleset(TestRuleset))
    // Act
    const current = resolveTurn(currentInput, CurrentRuleset, createSeededRng())
    const experimental = executeActions(compiled, state, submissions, createSeededRng)
    // Assert
    expect(current).toStrictEqual(Result.Success(expect.objectContaining({ players: expect.any(Object) })))
    expect(experimental).toStrictEqual(Result.Success(expect.objectContaining({ state: expect.any(Object) })))
    const currentState = extractSuccess(current)
    const experimentalState = extractSuccess(experimental).state
    expect(experimentalState.players).toStrictEqual(currentState.players)
    expect(experimentalState.winnerPlayerId).toStrictEqual(currentState.winnerPlayerId)
    expect(domainFleets(experimentalState.fleets)).toStrictEqual(domainFleets(currentState.fleets))
  })

  it.each([
    { name: "build", action: "BUILD_FLEET_STANDARD", create: createBuildScenario },
    { name: "merge", action: "MOVE_FLEET_EXCEPTIONAL", create: createMergeScenario },
    { name: "continue", action: "MOVE_FLEET_EXCEPTIONAL", create: createContinuingScenario },
  ])("should match $name beyond the simple fixture", ({ action, create }) => {
    // Arrange
    const scenario = create()
    const submissions = [submit(action, scenario.actor.id, selectedForAction(action, scenario))]
    const currentInput = createTurnStateStub({ ...structuredClone(scenario.state), submittedActions: submissions })
    const compiled = extractSuccess(compileRuleset(TestRuleset))
    // Act
    const current = resolveTurn(currentInput, CurrentRuleset, createSeededRng())
    const experimental = executeActions(compiled, scenario.state, submissions, createSeededRng)
    // Assert
    const expected = extractSuccess(current)
    expect(experimental).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({ players: expected.players, winnerPlayerId: expected.winnerPlayerId }),
        }),
      ),
    )
    expect(domainFleets(extractSuccess(experimental).state.fleets)).toStrictEqual(domainFleets(expected.fleets))
  })
})
