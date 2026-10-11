import { Assert, branded, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { computeActionCommitments, evaluateActionSelection, evaluateTargetSelection } from "#shared/action-submission/actionEligibility.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { ColonizeEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/ColonizeEffectDefinition.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { extractSuccess } from "#shared/testing/extractSuccess.ts"
import {
  corruptColonizationJourney,
  enumerateColonizationState,
  malformedColonizationDefinition,
  createColonizationScenario,
  nextColonizationTurn,
  positionFourthColonizationOwner,
} from "#shared/turn-resolution/ColonizationScenario.stub.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#shared/turn-resolution/ResolveTurnError.ts"

describe("configured Colonization", () => {
  it.each([
    [20, 20, 0],
    [20, 21, 1],
    [20, 35, 15],
    [25, 25, 0],
    [25, 35, 10],
  ])("should consumes configured%s from%s leaving%s", (requiredStrength, strength, survivor) => {
    // Arrange
    const fixture = createColonizationScenario({
      requiredStrength,
      orders: [{ owner: 1, strength, distance: 1, assault: false }],
      defenders: [],
    })
    const planet = structuredClone(fixture.destination)
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: expect.any(Object),
          resolvedActions: [
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([
                expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining(`consuming ${requiredStrength}`) }),
              ]),
            }),
          ],
        }),
      ),
    )
    expect(Object.values(fixture.state.fleets).map((fleet) => fleet.strength)).toStrictEqual(
      { 0: [], 1: [1], 10: [10], 15: [15] }[survivor],
    )
    expect(fixture.state.planets[planet.id]).toStrictEqual({ ...planet, ownerPlayerId: fixture.owners[0] })
    expect(Object.values(fixture.state.players)[0]?.resources).toMatchObject({ INFLUENCE: 75, FUEL: 100, COLONY: 0 })
  })

  it.each([
    [20, 19],
    [25, 24],
  ])("should rejects initial%s threshold force%s before costs", (requiredStrength, strength) => {
    // Arrange
    const fixture = createColonizationScenario({
      requiredStrength,
      orders: [{ owner: 1, strength, distance: 1, assault: false }],
      defenders: [],
    })
    const before = structuredClone(fixture.state)
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: expect.arrayContaining([expect.objectContaining({ issue: expect.stringContaining(`at least ${requiredStrength}`) })]),
        }),
      ),
    )
    expect(fixture.state).toStrictEqual(before)
  })

  it.each([
    [16, 19, "at least 20"],
    [35, 0, "destroyed"],
  ])("should Combat against%s prevents Colonization with survivor%s", (defender, survivor, reason) => {
    // Arrange
    const fixture = createColonizationScenario({
      orders: [{ owner: 1, strength: 35, distance: 1, assault: true }],
      defenders: [{ owner: 2, strength: defender, id: "enemy" }],
    })
    const definition = Object.values(fixture.ruleset.actionDefinitions)[0]
    Assert.isDefined(definition)
    fixture.ruleset = {
      ...fixture.ruleset,
      actionDefinitions: {
        [definition.id]: typedParse(ActionDefinitionSchema, { ...definition, effects: definition.effects.toReversed() }),
      },
    }
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([
                expect.objectContaining({
                  type: "PREVENTED",
                  reason: expect.stringContaining(reason),
                }),
              ]),
            }),
          ],
        }),
      ),
    )
    expect(fixture.state.planets[fixture.destination.id]?.ownerPlayerId).toBeNull()
    expect(Object.values(fixture.state.fleets).map((fleet) => fleet.strength)).toStrictEqual({ 0: [], 19: [19] }[survivor])
  })

  it("should does not attack an enemy without Assault", () => {
    // Arrange
    const fixture = createColonizationScenario({
      orders: [{ owner: 1, strength: 35, distance: 1, assault: false }],
      defenders: [{ owner: 2, strength: 16, id: "enemy" }],
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(
      Object.values(fixture.state.fleets)
        .map((fleet) => [fleet.ownerPlayerId, fleet.strength])
        .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toStrictEqual([
      [fixture.owners[0], 15],
      [fixture.owners[1], 16],
    ])
    expect(fixture.state.planets[fixture.destination.id]?.ownerPlayerId).toBe(fixture.owners[0])
  })

  it.each([
    { defenders: [], survivor: 20, preservedIds: [] },
    { defenders: [{ owner: 1, strength: 7, id: "station" }], survivor: 27, preservedIds: ["station"] },
  ])("should merge current force and consume once with $survivor survivor", ({ defenders, survivor, preservedIds }) => {
    // Arrange
    const fixture = createColonizationScenario({
      orders: [
        { owner: 1, strength: 20, distance: 0.1, assault: false },
        { owner: 1, strength: 20, distance: 0.2, assault: false },
      ],
      defenders,
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          resolvedActions: expect.arrayContaining([
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([expect.objectContaining({ type: "PREVENTED", reason: "Planet is already claimed" })]),
            }),
          ]),
        }),
      ),
    )
    const resolved = extractSuccess(result)
    expect(
      resolved.resolvedActions.map((action) => ({
        initiatingTurn: action.initiatingTurn,
        submittedAction: action.submittedAction,
        colonizeOutcome: action.actionOutcomes.at(-1),
      })),
    ).toStrictEqual([
      {
        initiatingTurn: 1,
        submittedAction: fixture.submissions[0],
        colonizeOutcome: { type: "RESOLVED", result: 'Planet "Destination" colonized, consuming 20 Strength' },
      },
      {
        initiatingTurn: 1,
        submittedAction: fixture.submissions[1],
        colonizeOutcome: { type: "PREVENTED", reason: "Planet is already claimed" },
      },
    ])
    expect(Object.values(fixture.state.fleets).map((fleet) => fleet.strength)).toStrictEqual([survivor])
    expect(Object.keys(fixture.state.fleets)).toStrictEqual(expect.arrayContaining(preservedIds))
  })

  it.each([false, true])("should eligible tied saved journeys use literal c,b,a and preserve RNG on reversed%s", (reverse) => {
    // Arrange: canonical owner UUID suffixes001,002,003; genuine prior departures avoid name draws at the arrival resolution.
    const fixture = createColonizationScenario({
      orders: [
        { owner: 1, strength: 35, distance: 2.11, assault: false },
        { owner: 2, strength: 35, distance: 2.19, assault: false },
        { owner: 3, strength: 35, distance: 2.11, assault: false },
      ],
      defenders: [],
    })
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const state = enumerateColonizationState(nextColonizationTurn(fixture), reverse)
    const rng = createSeededRng(1234)
    // Act
    const result = resolveTurn(state, fixture.ruleset, rng)
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ resolvedActions: expect.any(Array) })))
    expect(state.planets[fixture.destination.id]?.ownerPlayerId).toBe(fixture.owners[2])
    expect(
      Object.values(state.fleets)
        .map((fleet) => [fleet.ownerPlayerId, fleet.strength])
        .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toStrictEqual([
      [fixture.owners[0], 35],
      [fixture.owners[1], 35],
      [fixture.owners[2], 15],
    ])
    expect(rng.getState()).toStrictEqual({ generatorState: 3663132860, spareNormal: null })
  })

  it.each([19, 0])("should earlier invalid current force%s does not block a later valid arrival or draw RNG", (strength) => {
    // Arrange
    const fixture = createColonizationScenario({
      orders: [
        { owner: 1, strength: 35, distance: 2.01, assault: false },
        { owner: 2, strength: 35, distance: 2.11, assault: false },
        { owner: 3, strength: 35, distance: 2.21, assault: false },
      ],
      defenders: [],
    })
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const state = nextColonizationTurn(fixture)
    const first = Object.values(state.fleets).find((fleet) => fleet.ownerPlayerId === fixture.owners[0])
    Assert.isDefined(first)
    first.strength = strength
    const rng = createSeededRng(1234)
    // Act
    const reversed = enumerateColonizationState(structuredClone(state), true)
    const reverseRng = createSeededRng(1234)
    const result = resolveTurn(state, fixture.ruleset, rng)
    expect(resolveTurn(reversed, fixture.ruleset, reverseRng)).toStrictEqual(result)
    expect(reverseRng.getState()).toStrictEqual(rng.getState())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ resolvedActions: expect.any(Array) })))
    expect(state.planets[fixture.destination.id]?.ownerPlayerId).toBe(fixture.owners[1])
    expect(Object.values(state.fleets).find((fleet) => fleet.ownerPlayerId === fixture.owners[1])?.strength).toBe(15)
    expect(Object.values(state.fleets).find((fleet) => fleet.ownerPlayerId === fixture.owners[2])?.strength).toBe(35)
    expect(rng.getState()).toStrictEqual({ generatorState: 1234, spareNormal: null })
  })
})

describe("Colonization commitments and deferred integrity", () => {
  it.each([
    { requiredStrength: 20, departingStrength: 30, excessiveStrength: 31 },
    { requiredStrength: 25, departingStrength: 25, excessiveStrength: 26 },
  ])(
    "should fixed stationary$requiredStrength plus Move shares source50 without counting twice",
    ({ requiredStrength, departingStrength, excessiveStrength }) => {
      // Arrange
      const fixture = createColonizationScenario({
        requiredStrength,
        stationary: true,
        orders: [{ owner: 1, strength: 50, distance: 1, assault: false }],
        defenders: [],
      })
      const stationary = fixture.submissions[0]
      Assert.isDefined(stationary)
      const source = Object.values(fixture.state.fleets)[0]
      Assert.isDefined(source)
      const moving = createColonizationScenario({ orders: [{ owner: 1, strength: 50, distance: 1, assault: false }], defenders: [] })
      const definition = Object.values(moving.ruleset.actionDefinitions)[0]
      Assert.isDefined(definition)
      const moveDefinition = typedParse(ActionDefinitionSchema, {
        ...definition,
        id: "MOVE",
        effects: definition.effects.filter((effect) => effect.type === "FLEET_MOVE"),
        targets: {
          ...definition.targets,
          route: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: 25 }] },
        },
      })
      const destination = Object.values(fixture.state.planets).find((planet) => planet.id !== fixture.destination.id)
      Assert.isDefined(destination)
      const move = createSubmittedActionStub({
        id: "MOVE-1",
        actionDefinitionId: moveDefinition.id,
        playerId: stationary.playerId,
        selectedTargets: { craft: source.id, route: destination.id },
        selectedInputs: { force: departingStrength },
      })
      const ruleset = {
        ...fixture.ruleset,
        actionDefinitions: { ...fixture.ruleset.actionDefinitions, [moveDefinition.id]: moveDefinition },
        actionPool: [...fixture.ruleset.actionPool, { id: move.id, actionDefinitionId: move.actionDefinitionId }],
      }
      const state = { ...fixture.state, submittedActions: [stationary, move] }
      // Act
      const budget = computeActionCommitments({ ruleset, actions: state.submittedActions })
      const evaluation = evaluateActionSelection({ state, ruleset, action: stationary, selection: stationary, mode: "complete" })
      const excessive = createSubmittedActionStub({ ...move, selectedInputs: { force: excessiveStrength } })
      const invalid = evaluateActionSelection({ state, ruleset, action: excessive, selection: excessive, mode: "complete" })
      const result = resolveTurn(state, ruleset, createSeededRng())
      // Assert
      expect(budget.strength[source.id]).toBe(50)
      expect(evaluation.issues).toStrictEqual([])
      expect(invalid.issues).toContainEqual({
        path: ["selectedInputs", "force"],
        status: "invalid",
        shortfall: 1,
        message: "Insufficient fleet strength: shortfall 1",
      })
      expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
      expect(state.fleets[source.id]).toBeUndefined()
      expect(Object.values(state.fleets).map((fleet) => fleet.strength)).toStrictEqual([departingStrength])
      expect(state.planets[fixture.destination.id]?.ownerPlayerId).toBe(stationary.playerId)
    },
  )

  it("should moving35 reserves35 and additional Move15 fits while16 has shortfall1", () => {
    // Arrange
    const fixture = createColonizationScenario({ orders: [{ owner: 1, strength: 35, distance: 5, assault: false }], defenders: [] })
    const source = Object.values(fixture.state.fleets)[0]
    Assert.isDefined(source)
    source.strength = 50
    const action = fixture.submissions[0]
    Assert.isDefined(action)
    const definition = Object.values(fixture.ruleset.actionDefinitions)[0]
    Assert.isDefined(definition)
    const ordinary = typedParse(ActionDefinitionSchema, {
      ...definition,
      id: "MOVE",
      effects: definition.effects.filter((effect) => effect.type === "FLEET_MOVE"),
    })
    const extra = createSubmittedActionStub({ ...action, id: "EXTRA", actionDefinitionId: ordinary.id, selectedInputs: { force: 15 } })
    const ruleset = {
      ...fixture.ruleset,
      actionDefinitions: { ...fixture.ruleset.actionDefinitions, [ordinary.id]: ordinary },
      actionPool: [...fixture.ruleset.actionPool, { id: extra.id, actionDefinitionId: extra.actionDefinitionId }],
    }
    const state = { ...fixture.state, submittedActions: [action, extra] }
    const invalid = createSubmittedActionStub({ ...extra, selectedInputs: { force: 16 } })
    expect(evaluateActionSelection({ state, ruleset, action: extra, selection: extra, mode: "complete" }).issues).toStrictEqual([])
    expect(evaluateActionSelection({ state, ruleset, action: invalid, selection: invalid, mode: "complete" }).issues).toContainEqual({
      path: ["selectedInputs", "force"],
      status: "invalid",
      shortfall: 1,
      message: "Insufficient fleet strength: shortfall 1",
    })
    // Act
    const commitments = computeActionCommitments({ ruleset: fixture.ruleset, actions: [action] })
    // Assert
    expect(commitments.strength[source.id]).toBe(35)
    expect(
      evaluateActionSelection({ state: fixture.state, ruleset: fixture.ruleset, action, selection: action, mode: "complete" })
        .availableStrength[source.id],
    ).toBe(15)
  })

  it.each([
    [19, "ineligible"],
    [20, "ineligible"],
    [24, "ineligible"],
    [25, "eligible"],
  ] as const)("should evaluate stationary force%s as%s for configured25", (strength, status) => {
    // Arrange
    const fixture = createColonizationScenario({
      requiredStrength: 25,
      stationary: true,
      orders: [{ owner: 1, strength, distance: 1, assault: false }],
      defenders: [],
    })
    const action = fixture.submissions[0]
    Assert.isDefined(action)
    const sourceId = action.selectedTargets[branded<TargetTag>("craft")]
    Assert.isDefined(sourceId)
    // Act
    const evaluation = evaluateTargetSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      action,
      selection: { selectedTargets: {}, selectedInputs: {} },
      targetTag: branded<TargetTag>("craft"),
      targetId: sourceId,
    })
    // Assert
    expect(evaluation.status).toBe(status)
  })

  it("should reloads5 at speed2 as3,1,0, consumes only on arrival and preserves original outcome", () => {
    // Arrange
    const fixture = createColonizationScenario({
      turn: 4,
      orders: [{ owner: 1, strength: 35, distance: 5, assault: false }],
      defenders: [],
    })
    const original = fixture.submissions[0]
    Assert.isDefined(original)
    // Act
    const departure = extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const second = nextColonizationTurn(fixture)
    const progress = extractSuccess(resolveTurn(second, fixture.ruleset, createSeededRng()))
    const third = { ...structuredClone(second), turn: 6 }
    const arrival = resolveTurn(third, fixture.ruleset, createSeededRng())
    const idle = extractSuccess(resolveTurn({ ...structuredClone(third), turn: 7 }, fixture.ruleset, createSeededRng()))
    // Assert
    expect(Object.values(departure.fleets)[0]).toMatchObject({
      strength: 35,
      distanceToEnd: 3,
      movement: { initiatingTurn: 4, pendingArrivalEffects: [{ type: "COLONIZE", effectIndex: 1 }] },
    })
    expect(Object.values(progress.fleets)[0]).toMatchObject({ strength: 35, distanceToEnd: 1 })
    expect(arrival).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            expect.objectContaining({
              initiatingTurn: 4,
              submittedAction: original,
              actionOutcomes: [expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("consuming 20") })],
            }),
          ],
        }),
      ),
    )
    expect(Object.values(third.fleets)[0]).toMatchObject({
      strength: 15,
      movement: undefined,
      destinationPlanetId: undefined,
      distanceToEnd: undefined,
    })
    expect(third.players).toStrictEqual(departure.players)
    expect(idle.resolvedActions).toStrictEqual([])
  })

  it.each(["missing", "duplicate", "index", "requirement", "mapping", "extra", "variant"])(
    "should rejects saved%s corruption before mutations with valid control",
    (corruption) => {
      // Arrange
      const fixture = createColonizationScenario({ orders: [{ owner: 1, strength: 35, distance: 5, assault: false }], defenders: [] })
      extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
      const control = nextColonizationTurn(fixture)
      const corrupt = structuredClone(control)
      corruptColonizationJourney(corrupt, corruption)
      const before = structuredClone(corrupt)
      // Act
      const valid = resolveTurn(control, fixture.ruleset, createSeededRng())
      const invalid = resolveTurn(corrupt, fixture.ruleset, createSeededRng())
      // Assert
      expect(valid).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
      expect(invalid).toStrictEqual(
        Result.Failure(
          ResolveTurnError.FailedToResolvePhases({
            error: ResolvePhaseError.FailedEffect({ error: EffectError.Failed({ error: expect.any(String) }) }),
          }),
        ),
      )
      expect(corrupt).toStrictEqual(before)
    },
  )

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "should rejects invalid configured requirement%s",
    (requiredStrength) => {
      // Arrange
      const fixture = createColonizationScenario()
      const definition = Object.values(fixture.ruleset.actionDefinitions)[0]?.effects.find((effect) => effect.type === "COLONIZE")
      Assert.isDefined(definition)
      // Act
      const result = ColonizeEffectDefinitionSchema.safeParse({ ...definition, parameters: { requiredStrength } })
      // Assert
      expect(result.success).toBe(false)
    },
  )
})

describe("canonical eligible-only planet competition", () => {
  it.each([19, 0].flatMap((strength) => [false, true].map((first) => ({ strength, first }))))(
    "should invalid fourth force$strength first=$first leaves literal winner and RNG unchanged under reconstruction",
    ({ strength, first }) => {
      // Arrange: each saved binding comes from its genuine prior departure.
      const fixture = createColonizationScenario({
        orders: [1, 2, 3, 4].map((owner) => ({ owner, strength: 35, distance: 2.11, assault: false })),
        defenders: [],
      })
      positionFourthColonizationOwner(fixture, first)
      extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
      const state = nextColonizationTurn(fixture)
      const fourth = Object.values(state.fleets).find((fleet) => fleet.ownerPlayerId === fixture.owners[3])
      Assert.isDefined(fourth)
      fourth.strength = strength
      const rng = createSeededRng(1234)
      const reversed = enumerateColonizationState(structuredClone(state), true)
      const reverseRng = createSeededRng(1234)
      // Act
      const result = resolveTurn(state, fixture.ruleset, rng)
      const reverseResult = resolveTurn(reversed, fixture.ruleset, reverseRng)
      // Assert
      expect(reverseResult).toStrictEqual(result)
      expect(reversed).toStrictEqual(state)
      expect(reverseRng.getState()).toStrictEqual(rng.getState())
      expect(result).toStrictEqual(
        Result.Success(
          expect.objectContaining({
            resolvedActions: expect.arrayContaining([
              expect.objectContaining({
                submittedAction: expect.objectContaining({ playerId: fixture.owners[3] }),
                actionOutcomes: [expect.objectContaining({ type: "PREVENTED" })],
              }),
            ]),
          }),
        ),
      )
      expect(state.planets[fixture.destination.id]?.ownerPlayerId).toBe(fixture.owners[2])
      expect(Object.values(state.fleets).find((fleet) => fleet.ownerPlayerId === fixture.owners[2])?.strength).toBe(15)
      expect(rng.getState()).toStrictEqual({ generatorState: 3663132860, spareNormal: null })
    },
  )

  it.each([false, true])("should groups planet P before Q with literal b,a then c,d, reversed%s", (reverse) => {
    // Arrange: independent planet IDs fix the canonical grouping, with no arrival-resolution name draws.
    const fixture = createColonizationScenario({
      orders: [1, 2, 3, 4].map((owner) => ({ owner, strength: 35, distance: 2.11, assault: false })),
      defenders: [],
    })
    const p = createPlanetStub({ ...fixture.destination, id: "00000000-0000-4000-8000-000000000010" })
    const q = createPlanetStub({ ...fixture.destination, id: "00000000-0000-4000-8000-000000000020" })
    Reflect.deleteProperty(fixture.state.planets, fixture.destination.id)
    fixture.state.planets[p.id] = p
    fixture.state.planets[q.id] = q
    fixture.state = {
      ...fixture.state,
      submittedActions: fixture.submissions.map((action, index) => {
        const route = [p.id, p.id, q.id, q.id][index]
        Assert.isDefined(route)
        return createSubmittedActionStub({ ...action, selectedTargets: { ...action.selectedTargets, route } })
      }),
    }
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const state = enumerateColonizationState(nextColonizationTurn(fixture), reverse)
    const rng = createSeededRng(1234)
    // Act
    const result = resolveTurn(state, fixture.ruleset, rng)
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ resolvedActions: expect.any(Array) })))
    expect([state.planets[p.id]?.ownerPlayerId, state.planets[q.id]?.ownerPlayerId]).toStrictEqual([fixture.owners[1], fixture.owners[2]])
    expect(
      Object.values(state.fleets)
        .map((fleet) => [fleet.ownerPlayerId, fleet.strength])
        .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toStrictEqual([
      [fixture.owners[0], 35],
      [fixture.owners[1], 15],
      [fixture.owners[2], 15],
      [fixture.owners[3], 35],
    ])
    expect(rng.getState()).toStrictEqual({ generatorState: 3663132860, spareNormal: null })
  })
})

describe("complete stationary reservation sets", () => {
  it.each([
    { amount: 0, force: 10, moves: false, available: 10, canceled: 20, remaining: 30, children: [] },
    { amount: 10, force: 10, moves: true, available: 0, canceled: 30, remaining: 20, children: [10] },
  ])(
    "should reserve complete stationary set plus Move$amount",
    ({ force, moves, available, canceled: canceledStrength, remaining, children }) => {
      // Arrange
      const fixture = createColonizationScenario({
        stationary: true,
        orders: [{ owner: 1, strength: 50, distance: 1, assault: false }],
        defenders: [],
      })
      const first = fixture.submissions[0]
      Assert.isDefined(first)
      const second = createSubmittedActionStub({ ...first, id: "SECOND" })
      const source = Object.values(fixture.state.fleets)[0]
      Assert.isDefined(source)
      const moving = createColonizationScenario({ orders: [{ owner: 1, strength: 50, distance: 1, assault: false }], defenders: [] })
      const definition = Object.values(moving.ruleset.actionDefinitions)[0]
      Assert.isDefined(definition)
      const moveDefinition = typedParse(ActionDefinitionSchema, {
        ...definition,
        id: "MOVE",
        effects: definition.effects.filter((effect) => effect.type === "FLEET_MOVE"),
        targets: {
          ...definition.targets,
          route: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: 25 }] },
        },
      })
      const destination = Object.values(fixture.state.planets).find((planet) => planet.id !== fixture.destination.id)
      Assert.isDefined(destination)
      const move = createSubmittedActionStub({
        id: "MOVE-1",
        actionDefinitionId: moveDefinition.id,
        playerId: first.playerId,
        selectedTargets: { craft: source.id, route: destination.id },
        selectedInputs: { force },
      })
      const ruleset = {
        ...fixture.ruleset,
        actionDefinitions: { ...fixture.ruleset.actionDefinitions, [moveDefinition.id]: moveDefinition },
        actionPool: [
          ...fixture.ruleset.actionPool,
          { id: second.id, actionDefinitionId: second.actionDefinitionId },
          { id: move.id, actionDefinitionId: move.actionDefinitionId },
        ],
      }
      const state = { ...fixture.state, submittedActions: [first, second, ...[move].filter(() => moves)] }
      // Act
      const evaluation = evaluateActionSelection({ state, ruleset, action: first, selection: first, mode: "complete" })
      const excessive = createSubmittedActionStub({ ...move, selectedInputs: { force: 11 } })
      const invalid = evaluateActionSelection({ state, ruleset, action: excessive, selection: excessive, mode: "complete" })
      const canceled = computeActionCommitments({ ruleset, actions: state.submittedActions.filter((action) => action.id !== second.id) })
      const result = resolveTurn(state, ruleset, createSeededRng())
      // Assert
      expect(evaluation.issues).toStrictEqual([])
      expect(evaluation.availableStrength[source.id]).toBe(available)
      expect(invalid.issues).toContainEqual({
        path: ["selectedInputs", "force"],
        status: "invalid",
        shortfall: 1,
        message: "Insufficient fleet strength: shortfall 1",
      })
      expect(canceled.strength[source.id]).toBe(canceledStrength)
      expect(result).toStrictEqual(
        Result.Success(
          expect.objectContaining({
            resolvedActions: expect.arrayContaining([
              expect.objectContaining({
                actionOutcomes: expect.arrayContaining([
                  expect.objectContaining({ type: "PREVENTED", reason: "Planet is already claimed" }),
                ]),
              }),
            ]),
          }),
        ),
      )
      expect(state.fleets[source.id]?.strength).toBe(remaining)
      expect(
        Object.values(state.fleets)
          .filter((fleet) => fleet.id !== source.id)
          .map((fleet) => fleet.strength),
      ).toStrictEqual(children)
    },
  )

  it.each([
    "duplicate",
    "missing-owned",
    "missing-stationary",
    "missing-unclaimed",
    "wrong-fleet",
    "wrong-planet",
    "wrong-dependency",
    "stationary-input",
  ])("should rejects invalid Colonize composition%s", (malformation) => {
    // Arrange
    const fixture = createColonizationScenario({
      stationary: true,
      orders: [{ owner: 1, strength: 50, distance: 1, assault: false }],
      defenders: [],
    })
    const definition = malformedColonizationDefinition(fixture, malformation)
    // Act / Assert
    expect(ActionDefinitionSchema.safeParse(definition).success).toBe(false)
  })
})

describe("stationary phase-current priority", () => {
  it.each([
    { enemy: 16, laterOwner: 3, laterDistance: 2.2, claimedAfterFirst: 0, surviving: [4, 15] },
    { enemy: 20, laterOwner: 3, laterDistance: 2.2, claimedAfterFirst: 0, surviving: [15] },
    { enemy: 16, laterOwner: 3, laterDistance: 0.2, claimedAfterFirst: 3, surviving: [5, 14] },
    { enemy: 20, laterOwner: 2, laterDistance: 0.2, claimedAfterFirst: 2, surviving: [15] },
  ])(
    "should prevent damaged or dead Tick0 station against$enemy and allow later force at$laterDistance",
    ({ enemy, laterOwner, laterDistance, claimedAfterFirst, surviving }) => {
      // Arrange
      const fixture = createColonizationScenario({
        orders: [
          { owner: 1, strength: 20, distance: 1, assault: false },
          { owner: 2, strength: enemy, distance: 0.1, assault: true },
          { owner: laterOwner, strength: 35, distance: laterDistance, assault: false },
        ],
        defenders: [],
      })
      const definitions = Object.values(fixture.ruleset.actionDefinitions)
      const stationary = definitions[0],
        attack = definitions[1]
      Assert.isDefined(stationary)
      Assert.isDefined(attack)
      const fleet = Object.values(fixture.state.fleets).find((fleet) => fleet.ownerPlayerId === fixture.owners[0])
      Assert.isDefined(fleet)
      fleet.originPlanetId = fixture.destination.id
      const stationDefinition = typedParse(ActionDefinitionSchema, {
        ...stationary,
        inputs: {},
        targets: {
          ...stationary.targets,
          route: {
            targetType: "PLANET",
            constraints: [{ type: "UNCLAIMED_PLANET" }, { type: "AT_FLEET_PLANET", fleetTargetTag: "craft" }],
          },
        },
        effects: stationary.effects.filter((effect) => effect.type === "COLONIZE"),
      })
      const attackDefinition = typedParse(ActionDefinitionSchema, {
        ...attack,
        effects: attack.effects.filter((effect) => effect.type !== "COLONIZE"),
      })
      const first = fixture.submissions[0]
      Assert.isDefined(first)
      fixture.state = {
        ...fixture.state,
        submittedActions: [createSubmittedActionStub({ ...first, selectedInputs: {} }), ...fixture.submissions.slice(1)],
      }
      const ruleset = {
        ...fixture.ruleset,
        actionDefinitions: { ...fixture.ruleset.actionDefinitions, [stationary.id]: stationDefinition, [attack.id]: attackDefinition },
      }
      // Act
      const result = resolveTurn(fixture.state, ruleset, createSeededRng())
      expect(fixture.state.planets[fixture.destination.id]?.ownerPlayerId).toBe([null, ...fixture.owners][claimedAfterFirst])
      const later = { ...structuredClone(fixture.state), turn: 2, submittedActions: [] }
      const laterResult = resolveTurn(later, ruleset, createSeededRng())
      // Assert
      expect(laterResult).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
      expect(result).toStrictEqual(
        Result.Success(
          expect.objectContaining({
            resolvedActions: expect.arrayContaining([
              expect.objectContaining({
                submittedAction: expect.objectContaining({ playerId: fixture.owners[0] }),
                actionOutcomes: expect.arrayContaining([expect.objectContaining({ type: "PREVENTED" })]),
              }),
            ]),
          }),
        ),
      )
      expect(later.planets[fixture.destination.id]?.ownerPlayerId).toBe(fixture.owners[laterOwner - 1])
      expect(
        Object.values(later.fleets)
          .map((fleet) => fleet.strength)
          .toSorted((a, b) => a - b),
      ).toStrictEqual(surviving)
    },
  )
})

describe("initial Colonize ownership and exact location", () => {
  it.each([1, 2])("should reject initially claimed owner%s without costs or mutations", (owner) => {
    // Arrange
    const fixture = createColonizationScenario({ orders: [{ owner: 1, strength: 35, distance: 1, assault: false }], defenders: [] })
    const id = fixture.owners[owner - 1]
    Assert.isDefined(id)
    fixture.state.planets[fixture.destination.id] = { ...fixture.destination, ownerPlayerId: id }
    const before = structuredClone(fixture.state)
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: expect.arrayContaining([expect.objectContaining({ issue: "Planet is already claimed" })]),
        }),
      ),
    )
    expect(fixture.state).toStrictEqual(before)
  })

  it("should reject a different Planet ID at coincident coordinates for stationary Colonize", () => {
    // Arrange
    const fixture = createColonizationScenario({
      stationary: true,
      orders: [{ owner: 1, strength: 20, distance: 1, assault: false }],
      defenders: [],
    })
    const other = createPlanetStub({ ...fixture.destination, id: "coincident" })
    fixture.state.planets[other.id] = other
    const original = fixture.submissions[0]
    Assert.isDefined(original)
    const action = createSubmittedActionStub({ ...original, selectedTargets: { ...original.selectedTargets, route: other.id } })
    // Act
    const result = evaluateActionSelection({ state: fixture.state, ruleset: fixture.ruleset, action, selection: action, mode: "complete" })
    // Assert
    expect(result.issues).toContainEqual({
      path: ["selectedTargets", "route"],
      status: "invalid",
      message: "Planet must be at the source fleet",
    })
  })
})

describe("stationary and ordinary arrivals", () => {
  it("should give valid Tick0 stationary claim priority over moving Tick1 without consuming loser", () => {
    // Arrange
    const fixture = createColonizationScenario({
      orders: [
        { owner: 1, strength: 20, distance: 1, assault: false },
        { owner: 2, strength: 35, distance: 0.1, assault: false },
      ],
      defenders: [],
    })
    const definition = Object.values(fixture.ruleset.actionDefinitions)[0]
    Assert.isDefined(definition)
    const station = Object.values(fixture.state.fleets).find((fleet) => fleet.ownerPlayerId === fixture.owners[0])
    Assert.isDefined(station)
    station.originPlanetId = fixture.destination.id
    const stationary = typedParse(ActionDefinitionSchema, {
      ...definition,
      inputs: {},
      targets: {
        ...definition.targets,
        route: { targetType: "PLANET", constraints: [{ type: "UNCLAIMED_PLANET" }, { type: "AT_FLEET_PLANET", fleetTargetTag: "craft" }] },
      },
      effects: definition.effects.filter((effect) => effect.type === "COLONIZE"),
    })
    const first = fixture.submissions[0]
    Assert.isDefined(first)
    const state = {
      ...fixture.state,
      submittedActions: [createSubmittedActionStub({ ...first, selectedInputs: {} }), ...fixture.submissions.slice(1)],
    }
    const ruleset = { ...fixture.ruleset, actionDefinitions: { ...fixture.ruleset.actionDefinitions, [stationary.id]: stationary } }
    // Act
    const result = resolveTurn(state, ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          resolvedActions: expect.arrayContaining([
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([expect.objectContaining({ type: "PREVENTED", reason: "Planet is already claimed" })]),
            }),
          ]),
        }),
      ),
    )
    expect(state.planets[fixture.destination.id]?.ownerPlayerId).toBe(fixture.owners[0])
    expect(state.fleets[station.id]).toBeUndefined()
    expect(Object.values(state.fleets).map((fleet) => fleet.strength)).toStrictEqual([35])
  })

  it("should merge early Colonize20 and later ordinary15 using current35 then consume20 once", () => {
    // Arrange
    const fixture = createColonizationScenario({
      orders: [
        { owner: 1, strength: 20, distance: 0.1, assault: false },
        { owner: 1, strength: 15, distance: 0.2, assault: false },
      ],
      defenders: [],
    })
    const second = Object.values(fixture.ruleset.actionDefinitions)[1]
    Assert.isDefined(second)
    const ordinary = typedParse(ActionDefinitionSchema, {
      ...second,
      effects: second.effects.filter((effect) => effect.type !== "COLONIZE"),
    })
    const ruleset = { ...fixture.ruleset, actionDefinitions: { ...fixture.ruleset.actionDefinitions, [ordinary.id]: ordinary } }
    // Act
    const result = resolveTurn(fixture.state, ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(fixture.state.planets[fixture.destination.id]?.ownerPlayerId).toBe(fixture.owners[0])
    expect(Object.values(fixture.state.fleets).map((fleet) => fleet.strength)).toStrictEqual([15])
  })
})

describe("reservation source replacement and indexed deferred phases", () => {
  it("should shift only the replacing stationary20 reservation and reject its stale Planet", () => {
    // Arrange
    const fixture = createColonizationScenario({
      stationary: true,
      orders: [{ owner: 1, strength: 50, distance: 1, assault: false }],
      defenders: [],
    })
    const original = fixture.submissions[0]
    Assert.isDefined(original)
    const source = Object.values(fixture.state.fleets)[0]
    Assert.isDefined(source)
    const planet = createPlanetStub({ ...fixture.destination, id: "second-station" })
    const other = createFleetStub({ ...source, id: "other", originPlanetId: planet.id, strength: 50 })
    const second = createSubmittedActionStub({ ...original, id: "SECOND" })
    const ruleset = {
      ...fixture.ruleset,
      actionPool: [...fixture.ruleset.actionPool, { id: second.id, actionDefinitionId: second.actionDefinitionId }],
    }
    const state = {
      ...fixture.state,
      submittedActions: [original, second],
      planets: { ...fixture.state.planets, [planet.id]: planet },
      fleets: { ...fixture.state.fleets, [other.id]: other },
    }
    const replacement = createSubmittedActionStub({ ...original, selectedTargets: { craft: other.id, route: planet.id } })
    const stale = createSubmittedActionStub({ ...replacement, selectedTargets: { craft: other.id, route: fixture.destination.id } })
    // Act
    const evaluation = evaluateActionSelection({ state, ruleset, action: replacement, selection: replacement, mode: "complete" })
    const invalid = evaluateActionSelection({ state, ruleset, action: stale, selection: stale, mode: "complete" })
    // Assert
    expect(evaluation.issues).toStrictEqual([])
    expect(evaluation.commitments.strength).toStrictEqual({ [source.id]: 20, [other.id]: 20 })
    expect(evaluation.availableStrength).toStrictEqual({ [source.id]: 30, [other.id]: 30 })
    expect(invalid.issues).toContainEqual({
      path: ["selectedTargets", "route"],
      status: "invalid",
      message: "Planet must be at the source fleet",
    })
  })

  it("should preserve two original pending indexes and resolve Combat and Colonize once after reload", () => {
    // Arrange
    const fixture = createColonizationScenario({
      orders: [{ owner: 1, strength: 35, distance: 5, assault: true }],
      defenders: [{ owner: 2, strength: 16, id: "enemy" }],
    })
    const definition = Object.values(fixture.ruleset.actionDefinitions)[0]
    Assert.isDefined(definition)
    const ruleset = {
      ...fixture.ruleset,
      actionDefinitions: {
        [definition.id]: typedParse(ActionDefinitionSchema, { ...definition, effects: definition.effects.toReversed() }),
      },
    }
    const original = fixture.submissions[0]
    Assert.isDefined(original)
    // Act
    const departed = extractSuccess(resolveTurn(fixture.state, ruleset, createSeededRng()))
    const second = { ...structuredClone(departed), turn: 2, submittedActions: [] }
    extractSuccess(resolveTurn(second, ruleset, createSeededRng()))
    const third = { ...structuredClone(second), turn: 3, submittedActions: [] }
    const arrival = resolveTurn(third, ruleset, createSeededRng())
    const idle = extractSuccess(resolveTurn({ ...structuredClone(third), turn: 4, submittedActions: [] }, ruleset, createSeededRng()))
    // Assert
    expect(Object.values(departed.fleets).find((fleet) => fleet.movement !== undefined)?.movement?.pendingArrivalEffects).toStrictEqual([
      expect.objectContaining({ type: "COLONIZE", effectIndex: 0 }),
      expect.objectContaining({ type: "ASSAULT", effectIndex: 1 }),
    ])
    expect(arrival).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            expect.objectContaining({
              initiatingTurn: 1,
              submittedAction: original,
              actionOutcomes: [
                expect.objectContaining({ type: "RESOLVED" }),
                expect.objectContaining({ type: "PREVENTED", reason: "Colonization requires at least 20 Strength" }),
              ],
            }),
          ],
        }),
      ),
    )
    expect(Object.values(third.fleets).map((fleet) => fleet.strength)).toStrictEqual([19])
    expect(third.planets[fixture.destination.id]?.ownerPlayerId).toBeNull()
    expect(third.players).toStrictEqual(departed.players)
    expect(idle.resolvedActions).toStrictEqual([])
  })
})

describe("standalone stationary threshold resolution", () => {
  it("should reject stationary19 before payment and leave its saved state intact", () => {
    // Arrange
    const fixture = createColonizationScenario({
      stationary: true,
      orders: [{ owner: 1, strength: 19, distance: 1, assault: false }],
      defenders: [],
    })
    const before = structuredClone(fixture.state)
    const rng = createSeededRng(1234)
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, rng)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: expect.arrayContaining([expect.objectContaining({ issue: "Colonization requires at least 20 Strength" })]),
        }),
      ),
    )
    expect(fixture.state).toStrictEqual(before)
    expect(rng.getState()).toStrictEqual({ generatorState: 1234, spareNormal: null })
  })

  it("should accept stationary20 once without own-reservation subtraction or journey/name RNG", () => {
    // Arrange
    const fixture = createColonizationScenario({
      stationary: true,
      orders: [{ owner: 1, strength: 20, distance: 1, assault: false }],
      defenders: [],
    })
    const planet = structuredClone(fixture.destination)
    const rng = createSeededRng(1234)
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, rng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: {},
          resolvedActions: [
            {
              initiatingTurn: 1,
              submittedAction: fixture.submissions[0],
              actionOutcomes: [
                { type: "RESOLVED", result: 'Player "00000000-0000-4000-8000-000000000001" spent 25 INFLUENCE' },
                { type: "RESOLVED", result: 'Planet "Destination" colonized, consuming 20 Strength' },
              ],
            },
          ],
        }),
      ),
    )
    expect(fixture.state.planets[planet.id]).toStrictEqual({ ...planet, ownerPlayerId: fixture.owners[0] })
    expect(Object.values(fixture.state.players)[0]?.resources).toMatchObject({ INFLUENCE: 75, FUEL: 100, COLONY: 0 })
    expect(rng.getState()).toStrictEqual({ generatorState: 1234, spareNormal: null })
  })
})
