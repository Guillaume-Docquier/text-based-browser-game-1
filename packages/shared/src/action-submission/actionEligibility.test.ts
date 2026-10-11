import { Assert, branded, indexBy } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createFleetEligibilityScenario } from "#shared/action-submission/actionEligibility.stub.ts"
import type { ActionSelectionDraft } from "#shared/action-submission/actionEligibility.ts"
import {
  computeActionCommitments,
  evaluateActionSelection,
  evaluateSubmittedActions,
  evaluateTargetSelection,
  replaceActionSubmission,
} from "#shared/action-submission/actionEligibility.ts"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { extractSuccess } from "#shared/testing/extractSuccess.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"

describe("shared fleet action eligibility", () => {
  it("should accepts 20+30, rejects 20+31 by one in either order, and preserves source before resolution", () => {
    // Arrange
    const { state, ruleset: initialRuleset, definition, order, source } = createFleetEligibilityScenario()
    const alternate = ActionDefinitionSchema.parse({ ...definition, id: "alternate", tier: "IMPROVED" })
    const ruleset = Ruleset.create({
      ...initialRuleset,
      actionDefinitions: { ...initialRuleset.actionDefinitions, [alternate.id]: alternate },
      actionPool: initialRuleset.actionPool
        .filter((entry) => entry.id !== "Y")
        .concat({ id: order("Y", 30).id, actionDefinitionId: alternate.id }),
    })
    const valid = [order("X", 20), { ...order("Y", 30), actionDefinitionId: alternate.id }]
    const invalid = [order("X", 20), { ...order("Y", 31), actionDefinitionId: alternate.id }]
    // Act
    const accepted = evaluateSubmittedActions({ state, ruleset, submittedActions: valid })
    const rejected = [invalid, invalid.toReversed()].map((submittedActions) =>
      evaluateSubmittedActions({ state, ruleset, submittedActions }),
    )
    const resolution = resolveTurn({ ...state, submittedActions: invalid }, ruleset, createSeededRng())
    // Assert
    expect(accepted.map((result) => result.issues)).toStrictEqual([[], []])
    expect(computeActionCommitments({ ruleset, actions: valid }).strength).toStrictEqual({ source: 50 })
    for (const results of rejected)
      expect(results.map((result) => result.issues.map((issue) => [issue.path, issue.shortfall]))).toStrictEqual([
        [[["selectedInputs", "force"], 1]],
        [[["selectedInputs", "force"], 1]],
      ])
    expect(resolution).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
    expect(source.strength).toBe(50)
    expect(state.players[branded<PlayerId>("00000000-0000-4000-8000-000000000001")]?.resources.INFLUENCE).toBe(6)
  })

  it("should replaces and cancels only the matching instance including its costs", () => {
    // Arrange
    const { state, ruleset, order } = createFleetEligibilityScenario()
    const submittedActions = [order("X", 20), order("Y", 30)]
    // Act
    const replacement = evaluateActionSelection({
      state: { ...state, submittedActions },
      ruleset,
      action: order("X", 15),
      selection: order("X", 15),
      mode: "complete",
    })
    const cancelled = replaceActionSubmission(submittedActions, null, order("X", 20))
    // Assert
    expect(replacement).toMatchObject({
      eligible: true,
      commitments: { strength: { source: 45 }, resources: { "00000000-0000-4000-8000-000000000001": { INFLUENCE: 6, FUEL: 2 } } },
      availableStrength: { source: 5 },
    })
    expect(computeActionCommitments({ ruleset, actions: cancelled })).toMatchObject({
      strength: { source: 30 },
      resources: { "00000000-0000-4000-8000-000000000001": { INFLUENCE: 3, FUEL: 1 } },
    })
    expect(
      evaluateActionSelection({
        state: { ...state, submittedActions },
        ruleset,
        action: order("X", 21),
        selection: order("X", 21),
        mode: "complete",
      }),
    ).toMatchObject({ eligible: false, issues: [{ shortfall: 1 }] })
  })

  it("should reports aggregate resources independently of affordable strength", () => {
    // Arrange
    const { state, ruleset, order } = createFleetEligibilityScenario({ influence: 5 })
    // Act
    const results = evaluateSubmittedActions({ state, ruleset, submittedActions: [order("X", 1), order("Y", 1)] })
    // Assert
    expect(results.map((result) => result.issues)).toStrictEqual(
      Array.from({ length: 2 }, () => [
        { path: ["resources", "INFLUENCE"], status: "invalid", message: "Insufficient INFLUENCE: shortfall 1", shortfall: 1 },
      ]),
    )
  })

  it.each([
    [undefined, "incomplete"],
    [0, "invalid"],
    [-1, "invalid"],
    [1.5, "invalid"],
    [51, "invalid"],
    [Infinity, "invalid"],
    [NaN, "invalid"],
    [Number.MAX_SAFE_INTEGER + 1, "invalid"],
    [null, "invalid"],
    ["20", "invalid"],
  ] as const)("should rejects raw complete strength %s", (value, draftStatus) => {
    // Arrange
    const { state, ruleset, order } = createFleetEligibilityScenario()
    const action = order("X", 1)
    // Act
    const evaluation = evaluateActionSelection({
      state,
      ruleset,
      action,
      selection: { selectedTargets: action.selectedTargets, selectedInputs: { force: value } },
      mode: "complete",
    })
    const draft = evaluateActionSelection({
      state,
      ruleset,
      action,
      selection: { selectedTargets: action.selectedTargets, selectedInputs: { force: value } },
      mode: "draft",
    })
    // Assert
    expect(draft.issues).toContainEqual(expect.objectContaining({ path: ["selectedInputs", "force"], status: draftStatus }))
    expect(evaluation.eligible).toBe(false)
    expect(evaluation.issues).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ path: ["selectedInputs", "force"], status: "invalid" })]),
    )
  })

  it("should distinguishes missing drafts, exact range, source changes and coincident planets", () => {
    // Arrange
    const { state, ruleset, order, source } = createFleetEligibilityScenario()
    const targetTag = branded<TargetTag>("route")
    const outside = createPlanetStub({ id: "outside", x: 3, y: 4.000001 })
    const otherOrigin = createPlanetStub({ id: "other-origin", x: 10, y: 0 })
    const nextDestination = createPlanetStub({ id: "next", x: 10, y: 3 })
    const coincident = createPlanetStub({ id: "coincident", x: 0, y: 0 })
    const otherSource = { ...source, id: branded<typeof source.id>("other-source"), originPlanetId: otherOrigin.id, strength: 1 }
    const fullState = {
      ...state,
      planets: { ...state.planets, ...indexBy("id", [outside, otherOrigin, nextDestination, coincident]) },
      fleets: { ...state.fleets, [otherSource.id]: otherSource },
    }
    const action = order("X", 20)
    // Act
    const candidate = (id: string, selection: ActionSelectionDraft = action): ReturnType<typeof evaluateTargetSelection> =>
      evaluateTargetSelection({ state: fullState, ruleset, action, targetTag, targetId: id, selection })
    // Assert
    expect(candidate("destination").status).toBe("eligible")
    expect(candidate("outside").status).toBe("ineligible")
    expect(candidate("origin").status).toBe("ineligible")
    expect(candidate("coincident").status).toBe("eligible")
    expect(
      evaluateTargetSelection({
        state: fullState,
        ruleset,
        action,
        targetTag: branded("craft"),
        targetId: otherSource.id,
        selection: action,
      }).status,
    ).toBe("eligible")
    expect(candidate("next", { ...action, selectedTargets: { craft: otherSource.id } }).status).toBe("eligible")
    expect(candidate("destination", { ...action, selectedTargets: { craft: otherSource.id } }).status).toBe("ineligible")
    expect(
      evaluateActionSelection({
        state,
        ruleset,
        action,
        selection: { selectedTargets: {}, selectedInputs: {} },
        mode: "draft",
      }).issues.every((issue) => issue.status === "incomplete"),
    ).toBe(true)
    expect(
      evaluateTargetSelection({
        state: fullState,
        ruleset,
        action,
        targetTag,
        targetId: "destination",
        selection: { selectedTargets: {}, selectedInputs: {} },
      }).status,
    ).toBe("dependency-pending")
  })

  it.each(["enemy", "missing-origin", "moving", "exhausted"] as const)("should rejects source %s", (variant) => {
    // Arrange
    const { state, ruleset, order, source } = createFleetEligibilityScenario()
    const overrides = {
      enemy: { ownerPlayerId: branded<typeof source.ownerPlayerId>("enemy") },
      "missing-origin": { originPlanetId: branded<typeof source.originPlanetId>("missing") },
      moving: { destinationPlanetId: branded<typeof source.originPlanetId>("destination") },
      exhausted: { strength: 0 },
    }
    const fleet = { ...source, ...overrides[variant] }
    // Act
    const result = evaluateActionSelection({
      state: { ...state, fleets: { [fleet.id]: fleet } },
      ruleset,
      action: order("X", 1),
      selection: order("X", 1),
      mode: "complete",
    })
    // Assert
    expect(result.eligible).toBe(false)
  })

  it("should rejects malformed declarative movement compositions", () => {
    // Arrange
    const { definition } = createFleetEligibilityScenario()
    const variants = [
      { ...definition, inputs: {} },
      { ...definition, inputs: { ...definition.inputs, unused: { type: "FLEET_STRENGTH", fleetTargetTag: "craft" } } },
      { ...definition, effects: [...definition.effects, ...definition.effects] },
      { ...definition, targets: { ...definition.targets, craft: { targetType: "FLEET", constraints: [] } } },
      {
        ...definition,
        targets: {
          ...definition.targets,
          route: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "route", maximumDistance: 5 }] },
        },
      },
      ...[0, -1, Infinity].map((speed) => ({
        ...definition,
        effects: definition.effects.map((effect) => ({ ...effect, parameters: { speed } })),
      })),
      ...[0, -1, Infinity].map((maximumDistance) => ({
        ...definition,
        targets: {
          ...definition.targets,
          route: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance }] },
        },
      })),
    ]
    // Act
    const results = variants.map((value) => ActionDefinitionSchema.safeParse(value).success)
    // Assert
    expect(results).toStrictEqual(variants.map(() => false))
  })
})

describe("authoritative fleet boundary snapshots", () => {
  it("should reject duplicate instances and fresh source/resource changes before any payment", () => {
    // Arrange
    const scenario = createFleetEligibilityScenario({ strength: 20 })
    const action = scenario.order("X", 20)
    const player = scenario.state.players[scenario.playerId]
    Assert.isDefined(player)
    const snapshots = [
      { ...scenario.state, fleets: { [scenario.source.id]: { ...scenario.source, strength: 19 } } },
      { ...scenario.state, players: { [scenario.playerId]: { ...player, resources: { ...player.resources, INFLUENCE: 2 } } } },
    ]
    // Act
    const results = snapshots.map((state) => resolveTurn({ ...state, submittedActions: [action] }, scenario.ruleset, createSeededRng()))
    const duplicate = evaluateSubmittedActions({ state: scenario.state, ruleset: scenario.ruleset, submittedActions: [action, action] })
    // Assert
    expect(
      evaluateSubmittedActions({ state: scenario.state, ruleset: scenario.ruleset, submittedActions: [action] })[0]?.issues,
    ).toStrictEqual([])
    expect(results).toStrictEqual(
      results.map(() => expect.objectContaining({ type: "Failure", error: expect.objectContaining({ type: "INVALID_SUBMISSIONS" }) })),
    )
    expect(duplicate.flatMap((result) => result.issues)).toContainEqual(expect.objectContaining({ message: "Duplicate action instance" }))
  })

  it("should keep range independent from speed and reject unexpected selections", () => {
    // Arrange
    const scenario = createFleetEligibilityScenario()
    const action = scenario.order("X", 1)
    const selections = [
      { ...action, selectedInputs: { force: 1, extra: 1 } },
      { ...action, selectedTargets: { craft: scenario.source.id, route: scenario.destination.id, extra: "20" } },
      { ...action, selectedTargets: { craft: "20", route: scenario.destination.id } },
      { ...action, selectedTargets: { craft: scenario.destination.id, route: scenario.destination.id } },
    ]
    // Act
    const bounds = [1, 50].map(
      (strength) =>
        evaluateActionSelection({
          state: scenario.state,
          ruleset: scenario.ruleset,
          action,
          selection: scenario.order("X", strength),
          mode: "complete",
        }).eligible,
    )
    const slow = evaluateActionSelection({
      state: scenario.state,
      ruleset: createFleetEligibilityScenario({ speed: 1 }).ruleset,
      action,
      selection: action,
      mode: "complete",
    })
    const short = evaluateActionSelection({
      state: scenario.state,
      ruleset: createFleetEligibilityScenario({ range: 4 }).ruleset,
      action,
      selection: action,
      mode: "complete",
    })
    // Assert
    expect(bounds).toStrictEqual([true, true])
    expect(slow.eligible).toBe(true)
    expect(short.issues).toContainEqual(expect.objectContaining({ path: ["selectedTargets", "route"] }))
    expect(
      selections.map(
        (selection) =>
          evaluateActionSelection({ state: scenario.state, ruleset: scenario.ruleset, action, selection, mode: "complete" }).eligible,
      ),
    ).toStrictEqual([false, false, false, false])
  })
})

describe("playable partial movement", () => {
  it("should splits all allocations before progress deterministically and preserves the source identity", () => {
    // Arrange
    const scenario = createFleetEligibilityScenario()
    const submissions = [scenario.order("X", 20), scenario.order("Y", 15, scenario.second.id)]
    const run = (orders: typeof submissions): ResolvedTurnState =>
      extractSuccess(resolveTurn(structuredClone({ ...scenario.state, submittedActions: orders }), scenario.ruleset, createSeededRng()))
    // Act
    const forward = run(submissions)
    const reverse = run(submissions.toReversed())
    // Assert
    expect(forward.fleets).toStrictEqual(reverse.fleets)
    expect(forward.fleets[branded<FleetId>("source")]).toMatchObject({ name: "Original", strength: 15 })
    expect(
      Object.values(forward.fleets)
        .filter((fleet) => fleet.movement !== undefined)
        .map((fleet) => [fleet.strength, fleet.distanceToEnd]),
    ).toStrictEqual([
      [20, 3],
      [15, 3],
    ])
    expect(forward.players[branded<PlayerId>("00000000-0000-4000-8000-000000000001")]?.resources).toMatchObject({ INFLUENCE: 0, FUEL: 0 })
  })

  it.each([
    { distance: 1, speed: 0.1, arrivalTurn: 10, lastRemaining: 0.09999999999999998 },
    { distance: 1 + Number.EPSILON, speed: 0.1, arrivalTurn: 11, lastRemaining: Number.EPSILON },
    { distance: Number.MIN_VALUE, speed: 0.1, arrivalTurn: 1, lastRemaining: undefined },
  ])(
    "should arrive precisely on turn $arrivalTurn for fractional speed and distance $distance",
    ({ distance, speed, arrivalTurn, lastRemaining }) => {
      // Arrange
      const { state, ruleset, order, destination, playerId } = createFleetEligibilityScenario({ speed })
      const current = {
        ...state,
        planets: { ...state.planets, [destination.id]: { ...destination, x: distance, y: 0 } },
        submittedActions: [order("X", 20)],
      }
      // Act and assert every pre-arrival boundary before the final arrival.
      let observedLastRemaining: number | undefined
      for (let turn = 1; turn < arrivalTurn; turn++) {
        const resolved = extractSuccess(resolveTurn(current, ruleset, createSeededRng()))
        const journey = Object.values(resolved.fleets).find((fleet) => fleet.movement !== undefined)
        const available = computeAvailableActions({ playerIds: [playerId], ruleset, fleets: Object.values(resolved.fleets) })
        expect(journey?.distanceToEnd).toBeGreaterThan(0)
        expect(available.some((action) => action.id === "X")).toBe(false)
        expect(resolved.players[playerId]?.resources).toMatchObject({ INFLUENCE: 3, FUEL: 1 })
        // Exercise the load schema every turn, including the last tiny positive remainder.
        const reloaded = Object.values(resolved.fleets).map((fleet) => FleetSchema.parse(JSON.parse(JSON.stringify(fleet))))
        expect(reloaded.find((fleet) => fleet.movement !== undefined)?.movement).toMatchObject({ speed: 0.1, initiatingTurn: 1 })
        observedLastRemaining = journey?.distanceToEnd
        Object.assign(current, { turn: turn + 1, fleets: indexBy("id", reloaded), players: resolved.players, submittedActions: [] })
      }
      expect(observedLastRemaining).toBe(lastRemaining)
      const arrived = extractSuccess(resolveTurn(current, ruleset, createSeededRng()))
      expect(Object.values(arrived.fleets).find((fleet) => fleet.movement !== undefined)).toBeUndefined()
      expect(Object.values(arrived.fleets).find((fleet) => fleet.originPlanetId === destination.id)).toMatchObject({
        strength: 20,
        destinationPlanetId: undefined,
        distanceToEnd: undefined,
        movement: undefined,
      })
      expect(arrived.fleets[branded<FleetId>("source")]).toMatchObject({ strength: 30, originPlanetId: "origin" })
      expect(arrived.players[playerId]?.resources).toMatchObject({ INFLUENCE: 3, FUEL: 1 })
      expect(
        computeAvailableActions({ playerIds: [playerId], ruleset, fleets: Object.values(arrived.fleets) }).some(
          (action) => action.id === "X",
        ),
      ).toBe(true)
    },
  )

  it("should fully allocates and merges into an existing positive friendly fleet while preserving its identity", () => {
    // Arrange
    const { state, ruleset, order, source, destination, second } = createFleetEligibilityScenario({ speed: 5 })
    const stationed = {
      ...source,
      id: branded<typeof source.id>("stationed"),
      name: source.name,
      strength: 7,
      originPlanetId: destination.id,
    }
    // Act
    const resolved = extractSuccess(
      resolveTurn(
        { ...state, fleets: { ...state.fleets, [stationed.id]: stationed }, submittedActions: [order("X", 20), order("Y", 30, second.id)] },
        ruleset,
        createSeededRng(),
      ),
    )
    // Assert
    expect(resolved.fleets[source.id]).toBeUndefined()
    expect(resolved.fleets[stationed.id]).toMatchObject({ id: "stationed", name: "Original", strength: 27 })
    expect(
      Object.values(resolved.fleets)
        .map((fleet) => fleet.strength)
        .sort((first, second) => first - second),
    ).toStrictEqual([27, 30])
  })

  it("should arrives immediately at distinct coincident planets and rejects malformed saved journeys", () => {
    // Arrange
    const { state, ruleset, order, destination } = createFleetEligibilityScenario()
    const action = order("X", 20)
    // Act
    const resolved = extractSuccess(
      resolveTurn(
        { ...state, planets: { ...state.planets, [destination.id]: { ...destination, x: 0, y: 0 } }, submittedActions: [action] },
        ruleset,
        createSeededRng(),
      ),
    )
    // Assert
    expect(Object.values(resolved.fleets).find((fleet) => fleet.originPlanetId === destination.id)).toMatchObject({
      strength: 20,
      destinationPlanetId: undefined,
      distanceToEnd: undefined,
      movement: undefined,
    })
    expect(FleetSchema.safeParse({ ...state.fleets[branded<FleetId>("source")], destinationPlanetId: destination.id }).success).toBe(false)
  })
})

describe("terminal movement boundaries", () => {
  it("should keep hostile fleets separate and canonically merge friendly simultaneous arrivals", () => {
    // Arrange
    const scenario = createFleetEligibilityScenario({ speed: 5 })
    const enemy = {
      ...scenario.source,
      id: branded<FleetId>("enemy"),
      ownerPlayerId: branded<PlayerId>("00000000-0000-4000-8000-000000000002"),
      strength: 7,
      originPlanetId: scenario.destination.id,
    }
    const orders = [scenario.order("X", 20), scenario.order("Y", 30)]
    // Act
    const hostile = extractSuccess(
      resolveTurn(
        structuredClone({
          ...scenario.state,
          fleets: { ...scenario.state.fleets, [enemy.id]: enemy },
          submittedActions: [scenario.order("X", 20)],
        }),
        scenario.ruleset,
        createSeededRng(),
      ),
    )
    const friendly = extractSuccess(
      resolveTurn(structuredClone({ ...scenario.state, submittedActions: orders }), scenario.ruleset, createSeededRng()),
    )
    const reversed = extractSuccess(
      resolveTurn(structuredClone({ ...scenario.state, submittedActions: orders.toReversed() }), scenario.ruleset, createSeededRng()),
    )
    // Assert
    expect(hostile.fleets[enemy.id]).toMatchObject({ strength: 7, ownerPlayerId: "00000000-0000-4000-8000-000000000002" })
    expect(
      Object.values(hostile.fleets)
        .filter((fleet) => fleet.originPlanetId === scenario.destination.id)
        .filter((fleet) => fleet.ownerPlayerId === scenario.playerId)
        .map((fleet) => fleet.strength),
    ).toStrictEqual([20])
    expect(friendly.fleets).toStrictEqual(reversed.fleets)
    expect(Object.values(friendly.fleets).map((fleet) => fleet.strength)).toStrictEqual([50])
  })

  it("should clean terminal journeys and reject corrupt saved references", () => {
    // Arrange
    const scenario = createFleetEligibilityScenario()
    const first = extractSuccess(
      resolveTurn({ ...scenario.state, submittedActions: [scenario.order("X", 20)] }, scenario.ruleset, createSeededRng()),
    )
    const journey = Object.values(first.fleets).find((fleet) => fleet.movement !== undefined)
    Assert.isDefined(journey)
    // Act
    const terminal = extractSuccess(
      resolveTurn(
        { ...first, turn: 2, submittedActions: [], fleets: { ...first.fleets, [journey.id]: { ...journey, strength: 0 } } },
        scenario.ruleset,
        createSeededRng(),
      ),
    )
    const corrupt = resolveTurn(
      { ...first, turn: 2, submittedActions: [], planets: { [scenario.origin.id]: scenario.origin } },
      scenario.ruleset,
      createSeededRng(),
    )
    // Assert
    expect(terminal.fleets[journey.id]).toBeUndefined()
    expect(
      computeAvailableActions({ playerIds: [scenario.playerId], ruleset: scenario.ruleset, fleets: Object.values(terminal.fleets) }).map(
        (action) => action.id,
      ),
    ).toStrictEqual(["X", "Y", "Z"])
    expect(corrupt).toMatchObject({ type: "Failure" })
  })
})
