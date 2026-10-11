import { Assert, branded, Result } from "@guillaume-docquier/tools-ts"
import { typedParse, NonNegativeNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { createFleetEligibilityScenario } from "#shared/action-submission/actionEligibility.stub.ts"
import type { FleetEligibilityScenario } from "#shared/action-submission/actionEligibility.stub.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetMovement } from "#shared/domain/world/fleets/FleetMovement.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { extractSuccess } from "#shared/testing/extractSuccess.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"

describe("T1-r1-01", () => {
  it("should reject a saved journey referencing a nonexistent action definition", () => {
    // Arrange
    const scenario = createFleetEligibilityScenario()
    const first = extractSuccess(
      resolveTurn(structuredClone({ ...scenario.state, submittedActions: [scenario.order("X", 20)] }), scenario.ruleset, createSeededRng()),
    )
    const journey = Object.values(first.fleets).find((fleet) => fleet.movement !== undefined)
    Assert.isDefined(journey)
    const movement = journey.movement
    Assert.isDefined(movement)
    journey.movement = {
      ...movement,
      submittedAction: {
        ...movement.submittedAction,
        actionDefinitionId: branded<ActionDefinitionId>("missing-definition"),
      },
    }

    // Act
    const result = resolveTurn({ ...first, turn: 2, submittedActions: [] }, scenario.ruleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual(Result.Failure(expect.objectContaining({ type: "FAILED_TO_RESOLVE_PHASES" })))
  })
})

type JourneyFixture = { scenario: FleetEligibilityScenario; state: ResolvedTurnState; journey: ResolutionFleet; movement: FleetMovement }
function createJourneyFixture(): JourneyFixture {
  const scenario = createFleetEligibilityScenario()
  const state = extractSuccess(
    resolveTurn(structuredClone({ ...scenario.state, submittedActions: [scenario.order("X", 20)] }), scenario.ruleset, createSeededRng()),
  )
  const journey = Object.values(state.fleets).find((fleet) => fleet.movement !== undefined)
  Assert.isDefined(journey)
  const movement = journey.movement
  Assert.isDefined(movement)
  return { scenario, state, journey, movement }
}

const corruptions: Array<{ name: string; corrupt: (fixture: JourneyFixture) => Ruleset }> = [
  {
    name: "missing pooled instance",
    corrupt: ({ scenario, movement }) => {
      movement.submittedAction.id = branded<ActionId>("missing-instance")
      return scenario.ruleset
    },
  },
  {
    name: "pool/definition mismatch",
    corrupt: ({ scenario, movement }) => {
      const alternate = createActionDefinitionStub({ ...scenario.definition, id: "other-definition" })
      movement.submittedAction.actionDefinitionId = alternate.id
      return Ruleset.create({
        ...scenario.ruleset,
        actionDefinitions: { ...scenario.ruleset.actionDefinitions, [alternate.id]: alternate },
      })
    },
  },
  {
    name: "definition without movement",
    corrupt: ({ scenario }) => {
      const stationary = createActionDefinitionStub({ ...scenario.definition, inputs: {}, targets: {}, effects: [] })
      return Ruleset.create({ ...scenario.ruleset, actionDefinitions: { [stationary.id]: stationary } })
    },
  },
  {
    name: "changed movement mapping",
    corrupt: ({ scenario }) => {
      const sourceTarget = scenario.definition.targets[branded<TargetTag>("craft")]
      Assert.isDefined(sourceTarget)
      const changed = createActionDefinitionStub({
        ...scenario.definition,
        inputs: { power: { type: "FLEET_STRENGTH", fleetTargetTag: "vessel" } },
        targets: {
          vessel: sourceTarget,
          landing: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "vessel", maximumDistance: 5 }] },
        },
        effects: [FleetMoveEffectDefinition.create({ fleetTag: "vessel", planetTag: "landing", strengthTag: "power", speed: 2 })],
      })
      return Ruleset.create({ ...scenario.ruleset, actionDefinitions: { [changed.id]: changed } })
    },
  },
  {
    name: "missing source mapping",
    corrupt: ({ scenario, movement }) => {
      Reflect.deleteProperty(movement.submittedAction.selectedTargets, "craft")
      return scenario.ruleset
    },
  },
  {
    name: "altered source reference",
    corrupt: ({ scenario, movement }) => {
      Reflect.set(movement.submittedAction.selectedTargets, "craft", "another-source")
      return scenario.ruleset
    },
  },
  {
    name: "altered destination binding",
    corrupt: ({ scenario, movement }) => {
      Reflect.set(movement.submittedAction.selectedTargets, "route", scenario.second.id)
      return scenario.ruleset
    },
  },
  {
    name: "missing strength mapping",
    corrupt: ({ scenario, movement }) => {
      Reflect.deleteProperty(movement.submittedAction.selectedInputs, "force")
      return scenario.ruleset
    },
  },
  {
    name: "unexpected strength mapping",
    corrupt: ({ scenario, movement }) => {
      Reflect.set(movement.submittedAction.selectedInputs, "spare", 1)
      return scenario.ruleset
    },
  },
  {
    name: "child stronger than selected allocation",
    corrupt: ({ scenario, journey }) => {
      journey.strength = 21
      return scenario.ruleset
    },
  },
  {
    name: "fractional fleet strength",
    corrupt: ({ scenario, journey }) => {
      journey.strength = 1.5
      return scenario.ruleset
    },
  },
  {
    name: "negative fleet strength",
    corrupt: ({ scenario, journey }) => {
      journey.strength = -1
      return scenario.ruleset
    },
  },
  {
    name: "forged departure child",
    corrupt: ({ scenario, state, journey }) => {
      Reflect.deleteProperty(state.fleets, journey.id)
      const id = branded<typeof journey.id>("forged")
      state.fleets[id] = { ...journey, id }
      return scenario.ruleset
    },
  },
  {
    name: "mismatched fleet owner",
    corrupt: ({ scenario, state, journey }) => {
      const alternateId = branded<typeof journey.ownerPlayerId>("another-owner")
      const player = state.players[scenario.playerId]
      Assert.isDefined(player)
      Reflect.set(state.players, alternateId, { ...player, id: alternateId })
      journey.ownerPlayerId = alternateId
      return scenario.ruleset
    },
  },
  {
    name: "missing destination planet",
    corrupt: ({ scenario, state }) => {
      Reflect.deleteProperty(state.planets, scenario.destination.id)
      return scenario.ruleset
    },
  },
  {
    name: "future initiating Turn",
    corrupt: ({ scenario, movement }) => {
      movement.initiatingTurn = 3
      return scenario.ruleset
    },
  },
  {
    name: "missing initiating player",
    corrupt: ({ scenario, state }) => {
      Reflect.deleteProperty(state.players, scenario.playerId)
      return scenario.ruleset
    },
  },
  {
    name: "duplicate occupied instance",
    corrupt: ({ scenario, state, journey }) => {
      state.fleets[branded<typeof journey.id>("duplicate")] = structuredClone(journey)
      return scenario.ruleset
    },
  },
]

describe("persisted journey binding integrity", () => {
  it("should report saved instance corruption before progress and fresh payment without mutating state or RNG", () => {
    // Arrange
    const fixture = createJourneyFixture()
    fixture.movement.submittedAction.id = branded<ActionId>("missing-instance")
    fixture.journey.distanceToEnd = typedParse(NonNegativeNumberSchema, 0.5)
    const state = { ...fixture.state, turn: 2, submittedActions: [fixture.scenario.order("Y", 10)] }
    const before = structuredClone(state)
    const rng = createSeededRng()
    const beforeRng = rng.getState()
    // Act
    const result = resolveTurn(state, fixture.scenario.ruleset, rng)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure({
        type: "FAILED_TO_RESOLVE_PHASES",
        error: { type: "FAILED_TO_RESOLVE_EFFECT", error: { type: "FAILED", error: "Invalid persisted journey Action instance" } },
      }),
    )
    expect(state).toStrictEqual(before)
    expect(rng.getState()).toStrictEqual(beforeRng)
    expect(state.fleets[fixture.scenario.source.id]?.strength).toBe(30)
    expect(state.players[fixture.scenario.playerId]?.resources.INFLUENCE).toBe(3)
    expect(state.players[fixture.scenario.playerId]?.resources.FUEL).toBe(1)
  })

  it.each(corruptions)("should return typed corruption failure for $name", ({ corrupt }) => {
    // Arrange
    const fixture = createJourneyFixture()
    const ruleset = corrupt(fixture)
    const state = { ...fixture.state, turn: 2, submittedActions: [fixture.scenario.order("Y", 10)] }
    const before = structuredClone(state)
    // Act
    const result = resolveTurn(state, ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Failure(expect.objectContaining({ type: "FAILED_TO_RESOLVE_PHASES" })))
    expect(state).toStrictEqual(before)
  })

  it("should continue full allocation with saved speed despite changed current speed/range without paying again", () => {
    // Arrange
    const scenario = createFleetEligibilityScenario()
    const first = extractSuccess(
      resolveTurn(structuredClone({ ...scenario.state, submittedActions: [scenario.order("X", 50)] }), scenario.ruleset, createSeededRng()),
    )
    const changedRuleset = createFleetEligibilityScenario({ speed: 1, range: 1 }).ruleset
    const reloaded = Object.values(first.fleets).map((fleet) => FleetSchema.parse(JSON.parse(JSON.stringify(fleet))))
    // Act
    const second = extractSuccess(
      resolveTurn(
        { ...first, turn: 2, fleets: Object.fromEntries(reloaded.map((fleet) => [fleet.id, fleet])), submittedActions: [] },
        changedRuleset,
        createSeededRng(),
      ),
    )
    const third = extractSuccess(
      resolveTurn(
        {
          ...second,
          turn: 3,
          submittedActions: [],
          fleets: Object.fromEntries(
            Object.values(second.fleets).map((fleet) => {
              const loaded = FleetSchema.parse(JSON.parse(JSON.stringify(fleet)))
              return [loaded.id, loaded]
            }),
          ),
        },
        changedRuleset,
        createSeededRng(),
      ),
    )
    // Assert
    expect(first.fleets[scenario.source.id]).toBeUndefined()
    expect(Object.values(second.fleets)).toStrictEqual([
      expect.objectContaining({
        strength: 50,
        distanceToEnd: 1,
        movement: expect.objectContaining({ speed: 2, submittedAction: scenario.order("X", 50) }),
      }),
    ])
    expect(Object.values(third.fleets)).toStrictEqual([
      expect.objectContaining({ strength: 50, originPlanetId: scenario.destination.id, movement: undefined }),
    ])
    expect(second.players).toStrictEqual(first.players)
    expect(third.players).toStrictEqual(first.players)
    expect(first.players[scenario.playerId]?.resources).toMatchObject({ INFLUENCE: 3, FUEL: 1 })
  })
})

describe("R2-01 saved route and progress integrity", () => {
  it.each(
    [
      { name: "origin replaced with destination", origin: "destination", remaining: 3, reason: "Invalid persisted journey route" },
      {
        name: "origin replaced with another existing planet",
        origin: "second",
        remaining: 3,
        reason: "Inconsistent persisted journey progress",
      },
      { name: "remaining distance reduced", origin: "origin", remaining: 0.5, reason: "Inconsistent persisted journey progress" },
      { name: "remaining distance increased", origin: "origin", remaining: 4, reason: "Inconsistent persisted journey progress" },
    ].flatMap((variant) => [
      { ...variant, newAllocation: false, orderIds: [] },
      { ...variant, newAllocation: true, orderIds: ["Y"] },
    ]),
  )("should reject JSON-reloaded $name with new allocation $newAllocation before movement", ({ origin, remaining, orderIds, reason }) => {
    // Arrange
    const fixture = createJourneyFixture()
    expect(fixture.journey.distanceToEnd).toBe(3)
    const reloaded = FleetSchema.parse(JSON.parse(JSON.stringify({ ...fixture.journey, originPlanetId: origin, distanceToEnd: remaining })))
    const fleets: ResolvedTurnState["fleets"] = { ...fixture.state.fleets, [reloaded.id]: reloaded }
    const before = structuredClone(fleets)
    // Act
    const result = resolveTurn(
      { ...fixture.state, fleets, turn: 2, submittedActions: orderIds.map((id) => fixture.scenario.order(id, 10)) },
      fixture.scenario.ruleset,
      createSeededRng(),
    )
    // Assert
    expect(result).toStrictEqual(
      Result.Failure({
        type: "FAILED_TO_RESOLVE_PHASES",
        error: { type: "FAILED_TO_RESOLVE_EFFECT", error: { type: "FAILED", error: reason } },
      }),
    )
    expect(fleets).toStrictEqual(before)
    expect(fleets[fixture.scenario.source.id]?.strength).toBe(30)
    expect(fleets[reloaded.id]?.distanceToEnd).toBe(remaining)
  })
})
