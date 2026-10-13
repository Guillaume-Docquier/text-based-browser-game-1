import { Assert, branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createFleetEligibilityScenario } from "#shared/action-submission/actionEligibility.stub.ts"
import { evaluateActionSelection, evaluateTargetSelection, isActionOccupied } from "#shared/action-submission/actionEligibility.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { extractSuccess } from "#shared/testing/extractSuccess.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"

describe("R3-01 destination candidate prerequisites", () => {
  it.each([
    { name: "enemy", change: { ownerPlayerId: branded<PlayerId>("enemy") }, message: "Target must be owned by submitting player" },
    { name: "exhausted", change: { strength: 0 }, message: "Source fleet has no available strength" },
    { name: "missing origin", change: { originPlanetId: branded<PlanetId>("missing") }, message: "Source origin planet is missing" },
  ])("should retain the declared source error for a fresh $name source", ({ change, message }) => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const action = fixture.order("X", 20)
    const source = { ...fixture.source, ...change }
    const state = { ...fixture.state, fleets: { [source.id]: source } }
    // Act
    const candidate = evaluateTargetSelection({
      state,
      ruleset: fixture.ruleset,
      action,
      selection: action,
      targetTag: branded("route"),
      targetId: "destination",
    })
    const complete = evaluateActionSelection({ state, ruleset: fixture.ruleset, action, selection: action, mode: "complete" })
    // Assert
    expect(complete.eligible).toBe(false)
    expect(candidate.status).toBe("ineligible")
    expect(candidate.issues).toContainEqual({ path: ["selectedTargets", "craft"], status: "invalid", message })
  })

  it("should preserve both stationary exhaustion diagnostics around a missing origin", () => {
    const fixture = createFleetEligibilityScenario()
    const source = { ...fixture.source, strength: 0, originPlanetId: branded<PlanetId>("missing") }
    const action = fixture.order("X", 1)
    const candidate = evaluateTargetSelection({
      state: { ...fixture.state, fleets: { [source.id]: source } },
      ruleset: fixture.ruleset,
      action,
      selection: action,
      targetTag: branded("route"),
      targetId: "destination",
    })
    expect(candidate).toStrictEqual({
      status: "ineligible",
      issues: [
        { path: ["selectedTargets", "craft"], status: "invalid", message: "Source fleet has no available strength" },
        { path: ["selectedTargets", "craft"], status: "invalid", message: "Source origin planet is missing" },
        { path: ["selectedTargets", "craft"], status: "invalid", message: "Source fleet has no available strength" },
        { path: ["selectedTargets", "route"], status: "invalid", message: "Source origin or destination is missing" },
      ],
    })
  })

  it("should reject a persisted moving source bound to a different instance without an occupancy error", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const departed = extractSuccess(
      resolveTurn(structuredClone({ ...fixture.state, submittedActions: [fixture.order("Y", 20)] }), fixture.ruleset, createSeededRng()),
    )
    const child = Object.values(departed.fleets).find((fleet) => fleet.movement !== undefined)
    Assert.isDefined(child)
    const persisted = FleetSchema.parse(JSON.parse(JSON.stringify(child)))
    const action = fixture.order("X", 1)
    const selection = { ...action, selectedTargets: { craft: persisted.id, route: "destination" } }
    const state = { ...fixture.state, turn: 2, fleets: { ...departed.fleets, [persisted.id]: persisted }, submittedActions: [] }
    // Act
    const candidate = evaluateTargetSelection({
      state,
      ruleset: fixture.ruleset,
      action,
      selection,
      targetTag: branded("route"),
      targetId: "destination",
    })
    // Assert
    expect(persisted).toMatchObject({
      strength: 20,
      distanceToEnd: 3,
      destinationPlanetId: "destination",
      movement: { initiatingTurn: 1, submittedAction: { id: "Y" }, speed: 2 },
    })
    expect(isActionOccupied(state, action)).toBe(false)
    expect(isActionOccupied(state, fixture.order("Y", 1))).toBe(true)
    expect(candidate).toStrictEqual({
      status: "ineligible",
      issues: [{ path: ["selectedTargets", "craft"], status: "invalid", message: "Source fleet must be stationary" }],
    })
  })

  it("should reject a source fully reserved by another instance but exclude the edited instance", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const action = fixture.order("X", 20)
    const state = { ...fixture.state, submittedActions: [fixture.order("Y", 50)] }
    // Act
    const blocked = evaluateTargetSelection({
      state,
      ruleset: fixture.ruleset,
      action,
      selection: action,
      targetTag: branded("route"),
      targetId: "destination",
    })
    const edit = evaluateTargetSelection({
      state: { ...state, submittedActions: [fixture.order("X", 50)] },
      ruleset: fixture.ruleset,
      action,
      selection: action,
      targetTag: branded("route"),
      targetId: "destination",
    })
    // Assert
    expect(blocked.status).toBe("ineligible")
    expect(blocked.issues).toContainEqual({
      path: ["selectedTargets", "craft"],
      status: "invalid",
      message: "Source fleet has no available strength",
    })
    expect(edit).toStrictEqual({ status: "eligible", issues: [] })
  })

  it("should keep a missing source pending and reject an unknown selected source", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const action = fixture.order("X", 20)
    // Act
    const pending = evaluateTargetSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      action,
      selection: { selectedTargets: {}, selectedInputs: {} },
      targetTag: branded("route"),
      targetId: "destination",
    })
    const unknown = evaluateTargetSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      action,
      selection: { ...action, selectedTargets: { craft: "missing" } },
      targetTag: branded("route"),
      targetId: "destination",
    })
    // Assert
    expect(pending.status).toBe("dependency-pending")
    expect(unknown.status).toBe("ineligible")
    expect(unknown.issues).toContainEqual({ path: ["selectedTargets", "craft"], status: "invalid", message: "Unknown FLEET target" })
  })

  it("should still permit source reselection despite stale destination and excessive numeric draft", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const action = fixture.order("X", 20)
    const selection = { selectedTargets: { craft: "missing", route: "origin" }, selectedInputs: { force: 51 } }
    // Act
    const candidate = evaluateTargetSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      action,
      selection,
      targetTag: branded("craft"),
      targetId: "source",
    })
    // Assert
    expect(candidate).toStrictEqual({ status: "eligible", issues: [] })
  })

  it("should derive destination prerequisites from renamed constraint tags rather than fixture labels", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const sourceSlot = fixture.definition.targets[branded<TargetTag>("craft")]
    Assert.isDefined(sourceSlot)
    const definition = createActionDefinitionStub({
      ...fixture.definition,
      targets: {
        vessel: sourceSlot,
        landing: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "vessel", maximumDistance: 5 }] },
      },
      inputs: { power: { type: "FLEET_STRENGTH", fleetTargetTag: "vessel" } },
      effects: [FleetMoveEffectDefinition.create({ fleetTag: "vessel", planetTag: "landing", strengthTag: "power", speed: 2 })],
    })
    const ruleset = Ruleset.create({ ...fixture.ruleset, actionDefinitions: { [definition.id]: definition } })
    const action = fixture.order("X", 20)
    const selection = { selectedTargets: { vessel: "source", landing: "destination" }, selectedInputs: { power: 20 } }
    const state = { ...fixture.state, fleets: { [fixture.source.id]: { ...fixture.source, ownerPlayerId: branded<PlayerId>("enemy") } } }
    // Act
    const candidate = evaluateTargetSelection({ state, ruleset, action, selection, targetTag: branded("landing"), targetId: "destination" })
    // Assert
    expect(candidate).toStrictEqual({
      status: "ineligible",
      issues: [{ path: ["selectedTargets", "vessel"], status: "invalid", message: "Target must be owned by submitting player" }],
    })
  })
})
