import { Assert, branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createFleetEligibilityScenario } from "#shared/action-submission/actionEligibility.stub.ts"
import { evaluateActionSelection, evaluateSubmittedActions } from "#shared/action-submission/actionEligibility.ts"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { extractSuccess } from "#shared/testing/extractSuccess.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"

// Literal budget oracles protect pre-payment aggregate validation and the phase boundary.
describe("independent fleet allocation boundary regressions", () => {
  it("should sum repeated resource costs separately for each player sharing one pooled instance", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario({ influence: 5 })
    const definition = createActionDefinitionStub({
      ...fixture.definition,
      costs: [
        ResourceLossEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 3 }),
        ResourceLossEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 2 }),
        ResourceLossEffectDefinition.create({ resourceType: "FUEL", quantity: 1 }),
      ],
    })
    const ruleset = Ruleset.create({ ...fixture.ruleset, actionDefinitions: { [definition.id]: definition } })
    const otherId = branded<PlayerId>("00000000-0000-4000-8000-000000000002")
    const originalPlayer = fixture.state.players[fixture.playerId]
    Assert.isDefined(originalPlayer)
    const otherSource = { ...fixture.source, id: branded<typeof fixture.source.id>("other-source"), ownerPlayerId: otherId }
    const own = fixture.order("X", 20)
    const other = { ...own, playerId: otherId, selectedTargets: { ...own.selectedTargets, craft: otherSource.id } }
    const state = {
      ...fixture.state,
      players: { ...fixture.state.players, [otherId]: { id: otherId, resources: { ...originalPlayer.resources, INFLUENCE: 4 } } },
      fleets: { ...fixture.state.fleets, [otherSource.id]: otherSource },
    }
    const before = structuredClone(state)

    // Act
    const evaluations = evaluateSubmittedActions({ state, ruleset, submittedActions: [own, other] })
    const reversed = evaluateSubmittedActions({ state, ruleset, submittedActions: [other, own] })

    // Assert
    const shortage = [{ path: ["resources", "INFLUENCE"], status: "invalid", message: "Insufficient INFLUENCE: shortfall 1", shortfall: 1 }]
    expect(evaluations.map((evaluation) => evaluation.issues)).toStrictEqual([[], shortage])
    expect(reversed.map((evaluation) => evaluation.issues)).toStrictEqual([shortage, []])
    expect(state).toStrictEqual(before)
  })

  it("should reserve two costs once, reject a third, and pay precisely 6 Influence and 2 Fuel", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const pair = [fixture.order("X", 20), fixture.order("Y", 30)]
    // Act
    const third = evaluateActionSelection({
      state: { ...fixture.state, submittedActions: pair },
      ruleset: fixture.ruleset,
      action: fixture.order("Z", 1),
      selection: fixture.order("Z", 1),
      mode: "complete",
    })
    const resolved = extractSuccess(
      resolveTurn(structuredClone({ ...fixture.state, submittedActions: pair }), fixture.ruleset, createSeededRng()),
    )
    // Assert
    expect(third.issues).toContainEqual({
      path: ["resources", "INFLUENCE"],
      status: "invalid",
      message: "Insufficient INFLUENCE: shortfall 3",
      shortfall: 3,
    })
    expect(third.issues).toContainEqual({
      path: ["resources", "FUEL"],
      status: "invalid",
      message: "Insufficient FUEL: shortfall 1",
      shortfall: 1,
    })
    expect(resolved.players[fixture.playerId]?.resources).toMatchObject({ INFLUENCE: 0, FUEL: 0 })
  })

  it("should reject departure before payment even when a same-turn gain would cover its shortfall", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario({ influence: 5 })
    const gain = createActionDefinitionStub({
      id: "renamed-income",
      effects: [ResourceGainEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 100 })],
    })
    const ruleset = Ruleset.create({
      ...fixture.ruleset,
      actionDefinitions: { ...fixture.ruleset.actionDefinitions, [gain.id]: gain },
      actionPool: [...fixture.ruleset.actionPool, { id: "income-instance", actionDefinitionId: gain.id }],
    })
    const submissions = [
      fixture.order("X", 20),
      fixture.order("Y", 30),
      createSubmittedActionStub({ id: "income-instance", playerId: fixture.playerId, actionDefinitionId: gain.id }),
    ]
    const input = structuredClone({ ...fixture.state, submittedActions: submissions })
    const before = structuredClone(input)
    // Act
    const issues = evaluateSubmittedActions({ state: input, ruleset, submittedActions: submissions })
    const result = resolveTurn(input, ruleset, createSeededRng())
    // Assert
    expect(issues[0]?.issues).toContainEqual(expect.objectContaining({ path: ["resources", "INFLUENCE"], shortfall: 1 }))
    expect(result).toStrictEqual(Result.Failure(expect.objectContaining({ type: "INVALID_SUBMISSIONS" })))
    expect(input).toStrictEqual(before)
  })

  it.each([
    {
      name: "owner",
      expectedFailureType: "INVALID_SUBMISSIONS",
      fleet: { ownerPlayerId: branded<PlayerId>("00000000-0000-4000-8000-000000000002") },
      resources: {},
      strength: 20,
      influence: 6,
    },
    {
      name: "malformed transit",
      expectedFailureType: "FAILED_TO_RESOLVE_PHASES",
      fleet: { destinationPlanetId: branded<PlanetId>("destination") },
      resources: {},
      strength: 20,
      influence: 6,
    },
    { name: "strength", expectedFailureType: "INVALID_SUBMISSIONS", fleet: { strength: 19 }, resources: {}, strength: 19, influence: 6 },
    { name: "resources", expectedFailureType: "INVALID_SUBMISSIONS", fleet: {}, resources: { INFLUENCE: 2 }, strength: 20, influence: 2 },
  ])("should revalidate a previously valid selection after fresh $name changes", (change) => {
    // Arrange
    const fixture = createFleetEligibilityScenario({ strength: 20 })
    const action = fixture.order("X", 20)
    const player = fixture.state.players[fixture.playerId]
    Assert.isDefined(player)
    const state = {
      ...fixture.state,
      fleets: { [fixture.source.id]: { ...fixture.source, ...change.fleet } },
      players: { [fixture.playerId]: { ...player, resources: { ...player.resources, ...change.resources } } },
    }
    // Act
    const evaluation = evaluateActionSelection({ state, ruleset: fixture.ruleset, action, selection: action, mode: "complete" })
    const resolution = resolveTurn({ ...state, submittedActions: [action] }, fixture.ruleset, createSeededRng())
    // Assert
    expect(
      evaluateActionSelection({ state: fixture.state, ruleset: fixture.ruleset, action, selection: action, mode: "complete" }).eligible,
    ).toBe(true)
    expect(evaluation.eligible).toBe(false)
    expect(resolution).toStrictEqual(Result.Failure(expect.objectContaining({ type: change.expectedFailureType })))
    expect(state.fleets[fixture.source.id]?.strength).toBe(change.strength)
    expect(state.players[fixture.playerId]?.resources.INFLUENCE).toBe(change.influence)
  })

  it("should reload and replay paid partial movement with saved speed, source identity and instance release", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const input = { ...fixture.state, submittedActions: [fixture.order("X", 20)] }
    // Act
    const first = extractSuccess(resolveTurn(structuredClone(input), fixture.ruleset, createSeededRng()))
    const replay = extractSuccess(resolveTurn(structuredClone(input), fixture.ruleset, createSeededRng()))
    const reloaded = {
      ...first,
      fleets: Object.fromEntries(
        Object.values(first.fleets).map((fleet) => {
          const saved = FleetSchema.parse(JSON.parse(JSON.stringify(fleet)))
          return [saved.id, saved]
        }),
      ),
      players: structuredClone(first.players),
    }
    const occupied = computeAvailableActions({
      playerIds: [fixture.playerId],
      ruleset: fixture.ruleset,
      fleets: Object.values(reloaded.fleets),
    })
    const second = extractSuccess(
      resolveTurn({ ...reloaded, turn: 2, submittedActions: [] }, createFleetEligibilityScenario({ speed: 1 }).ruleset, createSeededRng()),
    )
    const third = extractSuccess(
      resolveTurn({ ...structuredClone(second), turn: 3, submittedActions: [] }, fixture.ruleset, createSeededRng()),
    )
    // Assert
    expect(replay).toStrictEqual(first)
    expect(occupied.map((action) => action.id)).toStrictEqual(["Y", "Z"])
    expect(
      computeAvailableActions({ playerIds: [fixture.playerId], ruleset: fixture.ruleset, fleets: Object.values(third.fleets) }).map(
        (action) => action.id,
      ),
    ).toStrictEqual(["X", "Y", "Z"])
    expect(Object.values(first.fleets).map((fleet) => [fleet.strength, fleet.distanceToEnd])).toStrictEqual([
      [30, undefined],
      [20, 3],
    ])
    expect(Object.values(second.fleets).map((fleet) => [fleet.strength, fleet.distanceToEnd])).toStrictEqual([
      [30, undefined],
      [20, 1],
    ])
    expect(Object.values(third.fleets).map((fleet) => [fleet.strength, fleet.distanceToEnd])).toStrictEqual([
      [30, undefined],
      [20, undefined],
    ])
    expect(first.players[fixture.playerId]?.resources).toMatchObject({ INFLUENCE: 3, FUEL: 1 })
    expect(second.players).toStrictEqual(first.players)
    expect(third.players).toStrictEqual(first.players)
    expect(Object.values(second.fleets).find((fleet) => fleet.movement !== undefined)?.movement).toMatchObject({
      speed: 2,
      initiatingTurn: 1,
      submittedAction: fixture.order("X", 20),
    })
    expect(third.fleets[fixture.source.id]).toMatchObject({ name: "Original", strength: 30, originPlanetId: fixture.origin.id })
  })
})
