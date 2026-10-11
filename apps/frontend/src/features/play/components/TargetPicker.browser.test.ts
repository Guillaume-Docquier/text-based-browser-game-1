import type { Action, TargetTag } from "@api-types"
import { Assert, branded } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { createActionDefinitionStub } from "shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { FleetSchema } from "shared/domain/world/fleets/Fleet.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "shared/testing/createSeededRng.ts"
import { extractSuccess } from "shared/testing/extractSuccess.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { describe, expect, it } from "vitest"
import { toActionEligibilityState } from "../actionEligibilityState.ts"
import { createFleetActionCardScenario } from "./ActionCard.stub.ts"
import { getTargetOptions } from "./TargetPicker.tsx"

describe("destination choices with fresh source prerequisites", () => {
  it.each([
    { name: "enemy", change: { ownerPlayerId: branded<PlayerId>("enemy") } },
    { name: "exhausted", change: { strength: 0 } },
    { name: "missing origin", change: { originPlanetId: branded<PlanetId>("missing-origin") } },
  ])("should remove destination options after the selected source becomes $name", ({ change }) => {
    // Arrange
    const fixture = createFleetActionCardScenario()
    const action = fixture.view.actions[0]
    const targetTag = branded<TargetTag>("route")
    const target = fixture.definition.targets[targetTag]
    const selection = fixture.scenario.order("X", 20)
    const changedView = { ...fixture.view, fleets: [{ ...fixture.scenario.source, ...change }] }
    // Act
    const before = getTargetOptions({
      targetDefinition: target,
      playerView: fixture.view,
      players: fixture.players,
      action,
      targetTag,
      selection,
      state: toActionEligibilityState(fixture.view),
    })
    const after = getTargetOptions({
      targetDefinition: target,
      playerView: changedView,
      players: fixture.players,
      action,
      targetTag,
      selection,
      state: toActionEligibilityState(changedView),
    })
    // Assert
    expect(before).toStrictEqual([
      { id: "destination", label: "Boundary (0:0:0)" },
      { id: "second", label: "Other (0:0:0)" },
    ])
    expect(after).toStrictEqual([])
  })

  it("should hide destinations for a coherent public journey belonging to Y while X remains usable", () => {
    // Arrange
    const fixture = createFleetActionCardScenario()
    const departed = extractSuccess(
      resolveTurn(
        structuredClone({ ...fixture.scenario.state, submittedActions: [fixture.scenario.order("Y", 20)] }),
        fixture.scenario.ruleset,
        createSeededRng(),
      ),
    )
    const child = Object.values(departed.fleets).find((fleet) => fleet.movement !== undefined)
    Assert.isDefined(child)
    const persisted = FleetSchema.parse(JSON.parse(JSON.stringify(child)))
    const view = {
      ...fixture.view,
      turn: 2,
      fleets: Object.values(departed.fleets).map((fleet) => FleetSchema.parse(JSON.parse(JSON.stringify(fleet)))),
      actions: [
        { ...fixture.view.actions[0], selectedTargets: null, selectedInputs: null, status: "AVAILABLE" as const },
        {
          ...fixture.view.actions[1],
          selectedTargets: null,
          selectedInputs: null,
          status: "IN_PROGRESS" as const,
          inProgressFleetId: persisted.id,
          destinationPlanetId: persisted.destinationPlanetId,
        },
        { ...fixture.view.actions[2], selectedTargets: null, selectedInputs: null, status: "AVAILABLE" as const },
      ],
    }
    const action = view.actions[0]
    const routeTag = branded<TargetTag>("route")
    const craftTag = branded<TargetTag>("craft")
    const selection = { selectedTargets: { craft: persisted.id }, selectedInputs: { force: 1 } }
    const state = toActionEligibilityState(view)
    // Act
    const destinations = getTargetOptions({
      targetDefinition: fixture.definition.targets[routeTag],
      playerView: view,
      players: fixture.players,
      action,
      targetTag: routeTag,
      selection,
      state,
    })
    const sources = getTargetOptions({
      targetDefinition: fixture.definition.targets[craftTag],
      playerView: view,
      players: fixture.players,
      action,
      targetTag: craftTag,
      selection,
      state,
    })
    // Assert
    expect(state.submittedActions).toStrictEqual([])
    expect(state.fleets[persisted.id]).toMatchObject({
      distanceToEnd: 3,
      strength: 20,
      movement: { initiatingTurn: 1, submittedAction: { id: "Y" }, speed: 2 },
    })
    expect(destinations).toStrictEqual([])
    expect(sources).toStrictEqual([{ id: "source", label: "Fleet source (30 strength)" }])
  })

  it.each([
    { name: "absent", selectedTargets: {} },
    { name: "unknown", selectedTargets: { craft: "missing" } },
  ])("should hide destinations with an $name selected source", ({ selectedTargets }) => {
    // Arrange
    const fixture = createFleetActionCardScenario()
    const tag = branded<TargetTag>("route")
    // Act
    const options = getTargetOptions({
      targetDefinition: fixture.definition.targets[tag],
      playerView: fixture.view,
      players: fixture.players,
      action: fixture.view.actions[0],
      targetTag: tag,
      selection: { selectedTargets, selectedInputs: {} },
      state: toActionEligibilityState(fixture.view),
    })
    // Assert
    expect(options).toStrictEqual([])
  })

  it("should honor sibling reservations and exclude the edited instance in the actual projection", () => {
    // Arrange
    const fixture = createFleetActionCardScenario()
    const reserved = fixture.scenario.order("Y", 50)
    const view = {
      ...fixture.view,
      actions: [
        { ...fixture.view.actions[0], selectedTargets: null, selectedInputs: null, status: "AVAILABLE" as const },
        {
          ...fixture.view.actions[1],
          selectedTargets: reserved.selectedTargets,
          selectedInputs: reserved.selectedInputs,
          status: "SUBMITTED" as const,
        },
        { ...fixture.view.actions[2], selectedTargets: null, selectedInputs: null, status: "AVAILABLE" as const },
      ],
    }
    const tag = branded<TargetTag>("route")
    const state = toActionEligibilityState(view)
    const selection = fixture.scenario.order("X", 20)
    // Act
    const blocked = getTargetOptions({
      targetDefinition: fixture.definition.targets[tag],
      playerView: view,
      players: fixture.players,
      action: view.actions[0],
      targetTag: tag,
      selection,
      state,
    })
    const edited = getTargetOptions({
      targetDefinition: fixture.definition.targets[tag],
      playerView: view,
      players: fixture.players,
      action: view.actions[1],
      targetTag: tag,
      selection,
      state,
    })
    // Assert
    expect(state.submittedActions).toStrictEqual([reserved])
    expect(state.players[fixture.scenario.playerId]?.resources).toMatchObject({ INFLUENCE: 6, FUEL: 2 })
    expect(blocked).toStrictEqual([])
    expect(edited).toStrictEqual([
      { id: "destination", label: "Boundary (0:0:0)" },
      { id: "second", label: "Other (0:0:0)" },
    ])
  })

  it("should keep valid source choices despite stale destination and invalid numeric drafts", () => {
    // Arrange
    const fixture = createFleetActionCardScenario()
    const tag = branded<TargetTag>("craft")
    const selection = { selectedTargets: { craft: "missing", route: "origin" }, selectedInputs: { force: 51 } }
    // Act
    const options = getTargetOptions({
      targetDefinition: fixture.definition.targets[tag],
      playerView: fixture.view,
      players: fixture.players,
      action: fixture.view.actions[0],
      targetTag: tag,
      selection,
      state: toActionEligibilityState(fixture.view),
    })
    // Assert
    expect(options).toStrictEqual([{ id: "source", label: "Fleet source (50 strength)" }])
  })

  it("should use renamed declared range prerequisites in frontend options", () => {
    // Arrange
    const fixture = createFleetActionCardScenario()
    const sourceSlot = fixture.definition.targets[branded<TargetTag>("craft")]
    const definition = createActionDefinitionStub({
      ...fixture.scenario.definition,
      targets: {
        vessel: sourceSlot,
        landing: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "vessel", maximumDistance: 5 }] },
      },
      inputs: { power: { type: "FLEET_STRENGTH", fleetTargetTag: "vessel" } },
      effects: [FleetMoveEffectDefinition.create({ fleetTag: "vessel", planetTag: "landing", strengthTag: "power", speed: 2 })],
    })
    const ruleset = Ruleset.create({ ...fixture.scenario.ruleset, actionDefinitions: { [definition.id]: definition } })
    const view = {
      ...fixture.view,
      ruleset,
      actions: fixture.view.actions.map((action): Action => ({
        ...action,
        status: "AVAILABLE",
        selectedTargets: null,
        selectedInputs: null,
      })),
    }
    const changed = { ...view, fleets: [{ ...fixture.scenario.source, ownerPlayerId: branded<PlayerId>("enemy") }] }
    const tag = branded<TargetTag>("landing")
    const selection = { selectedTargets: { vessel: "source" }, selectedInputs: { power: 20 } }
    // Act
    const valid = getTargetOptions({
      targetDefinition: definition.targets[tag],
      playerView: view,
      players: fixture.players,
      action: view.actions[0],
      targetTag: tag,
      selection,
      state: toActionEligibilityState(view),
    })
    const invalid = getTargetOptions({
      targetDefinition: definition.targets[tag],
      playerView: changed,
      players: fixture.players,
      action: changed.actions[0],
      targetTag: tag,
      selection,
      state: toActionEligibilityState(changed),
    })
    // Assert
    expect(valid).toStrictEqual([
      { id: "destination", label: "Boundary (0:0:0)" },
      { id: "second", label: "Other (0:0:0)" },
    ])
    expect(invalid).toStrictEqual([])
  })
})
