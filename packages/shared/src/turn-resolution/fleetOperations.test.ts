import { Assert, Result, Rng, mulberry32Prng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { extractSuccess } from "#shared/testing/extractSuccess.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import {
  createMalformedAssaultDefinition,
  createCorruptFleetOperationsScenario,
  createDefenderFixtures,
  changeMoveSpeed,
  reverseFleetOperationsState,
  createMergeDefenders,
  createFleetOperationsScenario,
} from "#shared/turn-resolution/FleetOperationsScenario.stub.ts"
import { resolveFleetCombatPhase } from "#shared/turn-resolution/phases/implementations/resolveFleetCombatPhase.ts"
import { resolveFleetMovementPhase, validateSavedFleets } from "#shared/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#shared/turn-resolution/ResolveTurnError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

function forces(state: Pick<TurnState, "fleets">): Array<{ owner: string; strength: number }> {
  return Object.values(state.fleets)
    .map((fleet) => ({ owner: fleet.ownerPlayerId, strength: fleet.strength }))
    .sort((a, b) => (a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : a.strength - b.strength))
}

describe("normal Assault and chronological journey integration", () => {
  it.each([
    [30, 20, 10, 0],
    [20, 30, 0, 10],
    [20, 20, 0, 0],
    [30, 0, 30, 0],
  ])("should exchanges one snapshot %s against %s", (a, d, left, right) => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [{ owner: 1, strength: a, distance: 1, assault: true }],
      defenders: [{ owner: 2, strength: d, id: "defender-a" }].filter((fleet) => fleet.strength > 0),
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: expect.any(Object),
          resolvedActions: [
            expect.objectContaining({
              initiatingTurn: 1,
              actionOutcomes: expect.arrayContaining([
                expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("Assault") }),
              ]),
            }),
          ],
        }),
      ),
    )
    expect(forces(fixture.state)).toStrictEqual(
      [
        { owner: fixture.owners[0], strength: left },
        { owner: fixture.owners[1], strength: right },
      ].filter((fleet) => fleet.strength > 0),
    )
    expect(
      computeAvailableActions({ playerIds: fixture.owners, ruleset: fixture.ruleset, fleets: Object.values(fixture.state.fleets) }),
    ).toHaveLength(3)
  })

  it.each([
    { a: 10, defenders: [10, 20], survivors: [7, 13] },
    { a: 1, defenders: [5, 5], survivors: [4, 5] },
    // Loss2b / combined3b: exact quotas 666666666 + 2/3 and 1333333333 + 1/3.
    { a: 2000000000, defenders: [1000000000, 2000000000], survivors: [333333333, 666666667] },
    { a: 2147483647, defenders: [2147483647, 2147483647], survivors: [1073741823, 1073741824] },
    { a: 2000000000, defenders: [2000000000, 2000000000, 2000000000], survivors: [1333333333, 1333333333, 1333333334] },
  ])("should apportions exact whole losses $a", ({ a, defenders, survivors }) => {
    // Arrange
    // Literal IDs defender-a < defender-b < defender-c establish remainder tie order independently.
    const fixture = createFleetOperationsScenario({
      orders: [{ owner: 1, strength: a, distance: 1, assault: true }],
      defenders: createDefenderFixtures(defenders),
    })
    const reversed = {
      ...structuredClone(fixture.state),
      fleets: Object.fromEntries(Object.entries(structuredClone(fixture.state.fleets)).toReversed()),
    }
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    const reverseResult = resolveTurn(reversed, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(reverseResult).toStrictEqual(result)
    expect(
      ["defender-a", "defender-b", "defender-c"]
        .map((id) => Object.values(fixture.state.fleets).find((fleet) => fleet.id === id)?.strength)
        .filter((value) => value !== undefined),
    ).toStrictEqual(survivors)
    expect(JSON.stringify(result)).not.toContain("BigInt")
  })

  it("should award a tied whole defender loss by code-point ID order instead of language collation", () => {
    // Arrange: uppercase Z precedes lowercase a in code-point order.
    const fixture = createFleetOperationsScenario({
      orders: [{ owner: 1, strength: 1, distance: 1, assault: true }],
      defenders: [
        { owner: 2, strength: 5, id: "fleet-a" },
        { owner: 3, strength: 5, id: "fleet-Z" },
      ],
    })
    const reversed = reverseFleetOperationsState(structuredClone(fixture.state), true)
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    const reverseResult = resolveTurn(reversed, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(reverseResult).toStrictEqual(result)
    expect(Object.values(fixture.state.fleets).find((fleet) => fleet.id === "fleet-Z")?.strength).toBe(4)
    expect(Object.values(fixture.state.fleets).find((fleet) => fleet.id === "fleet-a")?.strength).toBe(5)
    expect(Object.values(fixture.state.fleets).some((fleet) => fleet.ownerPlayerId === fixture.owners[0])).toBe(false)
  })

  it("should keeps deferred outcomes with original turn and selections after JSON reload", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [{ owner: 1, strength: 30, distance: 5, assault: true }],
      turn: 4,
      assaultCount: 2,
    })
    const rng = createSeededRng()
    // Act
    const departure = extractSuccess(resolveTurn(fixture.state, fixture.ruleset, rng))
    const next: TurnState = { ...JSON.parse(JSON.stringify(fixture.state)), turn: 5, submittedActions: [] }
    const continuing = extractSuccess(resolveTurn(next, fixture.ruleset, createSeededRng()))
    const final: TurnState = { ...JSON.parse(JSON.stringify(next)), turn: 6, submittedActions: [] }
    const replay = structuredClone(final)
    const arrival = resolveTurn(final, fixture.ruleset, createSeededRng())
    const repeated = resolveTurn(replay, fixture.ruleset, createSeededRng())
    const after = extractSuccess(resolveTurn({ ...final, turn: 7, submittedActions: [] }, fixture.ruleset, createSeededRng()))
    // Assert
    expect(Object.values(departure.fleets).find((fleet) => fleet.movement !== undefined)).toMatchObject({
      distanceToEnd: 3,
      movement: {
        initiatingTurn: 4,
        pendingArrivalEffects: [
          { type: "ASSAULT", effectIndex: 1 },
          { type: "ASSAULT", effectIndex: 2 },
        ],
      },
    })
    expect(departure.resolvedActions[0]?.actionOutcomes).toHaveLength(3)
    expect(continuing.resolvedActions).toStrictEqual([])
    expect(Object.values(continuing.fleets).find((fleet) => fleet.movement !== undefined)?.distanceToEnd).toBe(1)
    expect(arrival).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          turn: 6,
          resolvedActions: [
            {
              initiatingTurn: 4,
              submittedAction: fixture.submissions[0],
              actionOutcomes: [
                expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("exchanged 20") }),
                expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("exchanged 0") }),
              ],
            },
          ],
        }),
      ),
    )
    expect(repeated).toStrictEqual(arrival)
    expect(forces(final)).toStrictEqual([{ owner: fixture.owners[0], strength: 10 }])
    expect(Object.values(final.fleets)[0]).toMatchObject({
      movement: undefined,
      destinationPlanetId: undefined,
      distanceToEnd: undefined,
      arrivedAtTick: 10,
    })
    expect(Object.values(final.players)[0]?.resources).toMatchObject({ INFLUENCE: 95, FUEL: 99 })
    expect(after.resolvedActions).toStrictEqual([])
  })

  it.each([
    { distance: Number.MIN_VALUE, tick: 1 },
    { distance: 0, tick: 0 },
    { distance: 5, tick: 20 },
  ])("should preserves exact positive/zero/full boundary $tick", ({ distance, tick }) => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [{ owner: 1, strength: 20, distance, assault: true }],
      defenders: [],
      speed: 5,
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(Object.values(fixture.state.fleets)[0]).toMatchObject({ strength: 20, arrivedAtTick: tick, movement: undefined })
  })

  it("should arrives on tenth .01 turn without a floating point extra turn", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [{ owner: 1, strength: 20, distance: 0.1, assault: true }],
      defenders: [],
      speed: 0.01,
    })
    let state = fixture.state
    // Act
    for (let turn = 1; turn <= 9; turn++) {
      extractSuccess(resolveTurn(state, fixture.ruleset, createSeededRng()))
      state = { ...structuredClone(state), turn: turn + 1, submittedActions: [] }
    }
    const before = Object.values(state.fleets)[0]?.distanceToEnd
    const result = resolveTurn(state, fixture.ruleset, createSeededRng())
    // Assert
    expect(before).toBe(0.010000000000000009)
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(Object.values(state.fleets)[0]).toMatchObject({ strength: 20, arrivedAtTick: 20, movement: undefined })
  })

  it("should uses chronological merge survivor and all later friendly Strength", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 20, distance: 0.11, assault: true },
        { owner: 1, strength: 10, distance: 1.9, assault: true },
      ],
      defenders: [
        { owner: 1, strength: 7, id: "station" },
        { owner: 2, strength: 12, id: "enemy" },
      ],
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            expect.objectContaining({
              submittedAction: fixture.submissions[0],
              actionOutcomes: expect.arrayContaining([expect.objectContaining({ result: expect.stringContaining("exchanged 12") })]),
            }),
            expect.objectContaining({
              submittedAction: fixture.submissions[1],
              actionOutcomes: expect.arrayContaining([expect.objectContaining({ result: expect.stringContaining("exchanged 0") })]),
            }),
          ],
        }),
      ),
    )
    expect(Object.values(fixture.state.fleets)).toStrictEqual([expect.objectContaining({ id: "station", strength: 25 })])
  })

  it("should lets earlier Assault see late ordinary arrivals and prevents a destroyed pending attacker", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 30, distance: 0.01, assault: true },
        { owner: 2, strength: 20, distance: 0.11, assault: true },
      ],
      defenders: [{ owner: 3, strength: 10, id: "third" }],
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: {},
          resolvedActions: [
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([expect.objectContaining({ result: expect.stringContaining("exchanged 30") })]),
            }),
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([{ type: "PREVENTED", reason: "Attacking fleet was destroyed before this Assault" }]),
            }),
          ],
        }),
      ),
    )
  })

  it("should uses seeded canonical c,b,a ties after saved journeys regardless of enumeration", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 10, distance: 2.11, assault: true },
        { owner: 2, strength: 20, distance: 2.19, assault: true },
        { owner: 3, strength: 30, distance: 2.11, assault: true },
      ],
      defenders: [],
    })
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const state: TurnState = { ...structuredClone(fixture.state), turn: 2, submittedActions: [] }
    const reverse: TurnState = {
      ...structuredClone(state),
      fleets: Object.fromEntries(Object.entries(structuredClone(state.fleets)).toReversed()),
      players: Object.fromEntries(Object.entries(state.players).toReversed()),
      planets: Object.fromEntries(Object.entries(state.planets).toReversed()),
    }
    // Act
    const rng = createSeededRng(1234),
      reversedRng = createSeededRng(1234)
    const result = resolveTurn(state, fixture.ruleset, rng)
    const reverseResult = resolveTurn(reverse, fixture.ruleset, reversedRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: {},
          resolvedActions: [
            expect.objectContaining({
              submittedAction: fixture.submissions[0],
              actionOutcomes: [{ type: "PREVENTED", reason: "Attacking fleet was destroyed before this Assault" }],
            }),
            expect.objectContaining({
              submittedAction: fixture.submissions[1],
              actionOutcomes: [{ type: "PREVENTED", reason: "Attacking fleet was destroyed before this Assault" }],
            }),
            expect.objectContaining({
              submittedAction: fixture.submissions[2],
              actionOutcomes: [expect.objectContaining({ result: expect.stringContaining("exchanged 30") })],
            }),
          ],
        }),
      ),
    )
    expect(reverseResult).toStrictEqual(result)
    expect(reversedRng.getState()).toStrictEqual(rng.getState())
  })

  it.each([
    "missing-pending",
    "duplicate-index",
    "changed-composition",
    "wrong-type",
    "wrong-index",
    "wrong-role",
    "unsupported-parameter",
  ])("should fails corrupt saved $0 before any payment", (corruption) => {
    // Arrange
    const { state, ruleset } = createCorruptFleetOperationsScenario(corruption)
    const resources = structuredClone(state.players)
    // Act
    const result = resolveTurn(state, ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.FailedToResolvePhases({
          error: ResolvePhaseError.FailedEffect({ error: EffectError.Failed({ error: expect.any(String) }) }),
        }),
      ),
    )
    expect(state.players).toStrictEqual(resources)
  })
})

describe("movement provenance and explicit composition boundaries", () => {
  it("should order actual Assaults at true-zero, positive underflow and full-turn ticks", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 10, distance: 0, assault: true },
        { owner: 2, strength: 20, distance: Number.MIN_VALUE, assault: true },
        { owner: 3, strength: 30, distance: 5, assault: true },
      ],
      speed: 5,
      defenders: [],
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([
                expect.objectContaining({ result: expect.stringContaining("exchanged 10 Strength against 50") }),
              ]),
            }),
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([
                expect.objectContaining({ result: expect.stringContaining("exchanged 16 Strength against 24") }),
              ]),
            }),
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([expect.objectContaining({ result: expect.stringContaining("exchanged 0") })]),
            }),
          ],
        }),
      ),
    )
    expect(forces(fixture.state)).toStrictEqual([{ owner: fixture.owners[2], strength: 8 }])
  })

  it.each([false, true])("should keeps earliest chronological child with reversed enumeration=%s", (reverse) => {
    // Arrange
    // Independently computed UUID-v5 bindings: ORDER-0/source-0 = 8f10..., ORDER-1/source-1 = 2b1b...
    // ORDER-1 is early z20 at tick1; ORDER-0 is late a15 at tick20 despite earlier canonical action.
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 15, distance: 2, assault: true },
        { owner: 1, strength: 20, distance: 0.01, assault: true },
      ],
      defenders: [],
    })
    const state = reverseFleetOperationsState(fixture.state, reverse)
    // Act
    const result = resolveTurn(state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: { "2b1b26d2-dca1-5bd8-a95c-81a77453be4f": expect.objectContaining({ strength: 35, arrivedAtTick: 1 }) },
        }),
      ),
    )
    expect(Object.values(state.fleets)).toHaveLength(1)
  })

  it("should uses canonical simultaneous landing identity without RNG", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 20, distance: 0.11, assault: false },
        { owner: 1, strength: 15, distance: 0.19, assault: false },
      ],
      defenders: [],
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: { "8f10caba-b0d4-55ef-b4df-da5a7e847eec": expect.objectContaining({ strength: 35, arrivedAtTick: 2 }) },
        }),
      ),
    )
  })

  it.each([false, true])("should prevents the later merged order after survivor destruction with station=%s", (station) => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 10, distance: 0.01, assault: true },
        { owner: 1, strength: 10, distance: 0.11, assault: true },
      ],
      defenders: createMergeDefenders(station),
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: {},
          resolvedActions: [
            expect.objectContaining({ submittedAction: fixture.submissions[0] }),
            expect.objectContaining({
              submittedAction: fixture.submissions[1],
              actionOutcomes: expect.arrayContaining([{ type: "PREVENTED", reason: "Attacking fleet was destroyed before this Assault" }]),
            }),
          ],
        }),
      ),
    )
  })

  it("should finishes all Movement before Combat against a later ordinary arrival", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 10, distance: 0.01, assault: true },
        { owner: 2, strength: 30, distance: 2, assault: false },
      ],
      defenders: [],
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(forces(fixture.state)).toStrictEqual([{ owner: fixture.owners[1], strength: 20 }])
  })

  it("should snapshots same-turn Build reinforcements after Movement", () => {
    // Arrange
    const fixture = createFleetOperationsScenario()
    const owner = fixture.owners[1]
    Assert.isDefined(owner)
    const defender = Object.values(fixture.state.fleets).find((fleet) => fleet.id === "defender-a")
    Assert.isDefined(defender)
    defender.strength = 10
    const build = createActionDefinitionStub({
      id: "BUILD",
      effects: [FleetBuildEffectDefinition.create({ planetTag: "place", strength: 10 })],
      targets: { place: { targetType: "PLANET", constraints: [] } },
    })
    const action = createSubmittedActionStub({
      id: "BUILD-1",
      actionDefinitionId: build.id,
      playerId: owner,
      selectedTargets: { place: fixture.destination.id },
    })
    const state = { ...fixture.state, submittedActions: [...fixture.state.submittedActions, action] }
    const ruleset = {
      ...fixture.ruleset,
      actionDefinitions: { ...fixture.ruleset.actionDefinitions, [build.id]: build },
      actionPool: [...fixture.ruleset.actionPool, { id: action.id, actionDefinitionId: build.id }],
    }
    // Act
    const result = resolveTurn(state, ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(forces(state)).toStrictEqual([{ owner: fixture.owners[0], strength: 10 }])
  })

  it("should exchange the later surviving attacker strength against remaining defenders", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 90, distance: 0.01, assault: true },
        { owner: 2, strength: 40, distance: 0.11, assault: true },
      ],
      defenders: [{ owner: 3, strength: 80, id: "remaining-opponent" }],
    })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([
                expect.objectContaining({ result: expect.stringContaining("exchanged 90 Strength against 120") }),
              ]),
            }),
            expect.objectContaining({
              actionOutcomes: expect.arrayContaining([
                expect.objectContaining({ result: expect.stringContaining("exchanged 10 Strength against 20") }),
              ]),
            }),
          ],
        }),
      ),
    )
    expect(forces(fixture.state)).toStrictEqual([{ owner: fixture.owners[2], strength: 10 }])
  })

  it.each([false, true])("should ordinary Move versus explicit Assault composition=%s", (assault) => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [{ owner: 1, strength: 20, distance: 1, assault }],
      defenders: [{ owner: 2, strength: 7, id: "enemy" }],
    })
    const ruleset = {
      ...fixture.ruleset,
      actionDefinitions: Object.fromEntries(
        Object.values(fixture.ruleset.actionDefinitions).map((definition) => [
          definition.id,
          typedParse(ActionDefinitionSchema, { ...definition, effects: [...definition.effects].toReversed() }),
        ]),
      ),
    }
    // Act
    const result = resolveTurn(fixture.state, ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(forces(fixture.state)).toStrictEqual(
      new Map([
        [true, [{ owner: fixture.owners[0], strength: 13 }]],
        [
          false,
          [
            { owner: fixture.owners[0], strength: 20 },
            { owner: fixture.owners[1], strength: 7 },
          ],
        ],
      ]).get(assault),
    )
  })

  it("should supports ordinary legacy absent pending data and saved speed after definition changes", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({ orders: [{ owner: 1, strength: 20, distance: 5, assault: false }], defenders: [] })
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const journey = Object.values(fixture.state.fleets)[0]
    Assert.isDefined(journey)
    Assert.isDefined(journey.movement)
    journey.movement.pendingArrivalEffects = undefined
    const ruleset = changeMoveSpeed(fixture.ruleset, 1)
    const state = { ...structuredClone(fixture.state), turn: 2, submittedActions: [] }
    // Act
    const result = resolveTurn(state, ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: { [journey.id]: expect.objectContaining({ distanceToEnd: 1, movement: expect.objectContaining({ speed: 2 }) }) },
        }),
      ),
    )
  })

  it("should completes pending terminal-zero transit as Prevented with instance release", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({ orders: [{ owner: 1, strength: 20, distance: 5, assault: true }], defenders: [] })
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const journey = Object.values(fixture.state.fleets)[0]
    Assert.isDefined(journey)
    journey.strength = 0
    const state = { ...structuredClone(fixture.state), turn: 2, submittedActions: [] }
    // Act
    const result = resolveTurn(state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          fleets: {},
          resolvedActions: [
            {
              initiatingTurn: 1,
              submittedAction: fixture.submissions[0],
              actionOutcomes: [{ type: "PREVENTED", reason: "Attacking fleet was destroyed before this Assault" }],
            },
          ],
        }),
      ),
    )
    expect(computeAvailableActions({ playerIds: fixture.owners, ruleset: fixture.ruleset, fleets: [] })).toHaveLength(3)
  })

  it("should retains independent ordinary20 and Attack15 children from source50 across 2/2/1 reloads", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 20, distance: 5, assault: false },
        { owner: 1, strength: 15, distance: 5, assault: true },
      ],
      defenders: [],
    })
    const source = Object.values(fixture.state.fleets).find((fleet) => fleet.id === "source-0")
    const other = Object.values(fixture.state.fleets).find((fleet) => fleet.id === "source-1")
    const originalSecondOrder = fixture.state.submittedActions[1]
    Assert.isDefined(source)
    Assert.isDefined(other)
    Assert.isDefined(originalSecondOrder)
    source.strength = 50
    Reflect.deleteProperty(fixture.state.fleets, other.id)
    const secondDestination = createPlanetStub({ id: "other-destination", x: 0, y: 0 })
    Reflect.set(fixture.state.planets, secondDestination.id, secondDestination)
    const secondOrder = { ...originalSecondOrder, selectedTargets: { craft: source.id, route: secondDestination.id } }
    const firstOrder = fixture.state.submittedActions[0]
    Assert.isDefined(firstOrder)
    Reflect.set(fixture.state, "submittedActions", [firstOrder, secondOrder])
    // Act
    const departure = extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const middle = { ...structuredClone(fixture.state), turn: 2, submittedActions: [] }
    const continuation = extractSuccess(resolveTurn(middle, fixture.ruleset, createSeededRng()))
    const final = { ...structuredClone(middle), turn: 3, submittedActions: [] }
    const arrival = extractSuccess(resolveTurn(final, fixture.ruleset, createSeededRng()))
    const idle = { ...structuredClone(final), turn: 4 }
    const after = extractSuccess(resolveTurn(idle, fixture.ruleset, createSeededRng()))
    // Assert
    expect(departure.fleets[source.id]?.strength).toBe(15)
    expect(
      Object.values(departure.fleets)
        .filter((fleet) => fleet.movement !== undefined)
        .map((fleet) => ({ strength: fleet.strength, remaining: fleet.distanceToEnd }))
        .sort((a, b) => a.strength - b.strength),
    ).toStrictEqual([
      { strength: 15, remaining: 3 },
      { strength: 20, remaining: 3 },
    ])
    expect(
      Object.values(continuation.fleets)
        .filter((fleet) => fleet.movement !== undefined)
        .map((fleet) => fleet.distanceToEnd),
    ).toStrictEqual([1, 1])
    expect(arrival.resolvedActions).toStrictEqual([
      expect.objectContaining({
        initiatingTurn: 1,
        submittedAction: secondOrder,
        actionOutcomes: [expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("exchanged 0 Strength against 0") })],
      }),
    ])
    expect(
      Object.values(arrival.fleets)
        .map((fleet) => fleet.strength)
        .sort((a, b) => a - b),
    ).toStrictEqual([15, 15, 20])
    expect(Object.values(arrival.fleets).every((fleet) => fleet.movement === undefined)).toBe(true)
    expect(Object.values(arrival.players)[0]?.resources).toMatchObject({ INFLUENCE: 90, FUEL: 98 })
    expect(after.fleets).toStrictEqual(arrival.fleets)
    expect(after.players).toStrictEqual(arrival.players)
    expect(after.resolvedActions).toStrictEqual([])
  })

  it.each(["missing-move", "wrong-fleet-role", "wrong-planet-role", "wrong-type", "extra-role", "unsupported-parameters"])(
    "should rejects malformed Assault composition %s",
    (malformation) => {
      // Arrange
      const definition = createMalformedAssaultDefinition(malformation)
      // Act
      const result = ActionDefinitionSchema.safeParse(definition)
      // Assert
      expect(result.success).toBe(false)
    },
  )

  it.each([
    { distance: 0.11, tick: 2 },
    { distance: 0.19, tick: 2 },
    { distance: 0.21, tick: 3 },
  ])("should uses literal rounded tick $tick for distance $distance", ({ distance, tick }) => {
    // Arrange
    const fixture = createFleetOperationsScenario({ orders: [{ owner: 1, strength: 20, distance, assault: true }], defenders: [] })
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(Object.values(fixture.state.fleets)[0]?.arrivedAtTick).toBe(tick)
  })

  it("should keeps preexisting station7 identity after chronological ordinary20 and15 arrivals", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 20, distance: 0.01, assault: false },
        { owner: 1, strength: 15, distance: 2, assault: false },
      ],
      defenders: [{ owner: 1, strength: 7, id: "station" }],
    })
    const reversed = reverseFleetOperationsState(structuredClone(fixture.state), true)
    // Act
    const result = resolveTurn(fixture.state, fixture.ruleset, createSeededRng())
    const replay = resolveTurn(reversed, fixture.ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Success(expect.objectContaining({ fleets: { station: expect.objectContaining({ id: "station", strength: 42 }) } })),
    )
    expect(replay).toStrictEqual(result)
  })

  it("should consumes no Combat RNG draw for a single saved Assault arrival", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({ orders: [{ owner: 1, strength: 30, distance: 3, assault: true }] })
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const state = { ...structuredClone(fixture.state), turn: 2, submittedActions: [] }
    const rng = createSeededRng(1234)
    const before = rng.getState()
    // Act
    const result = resolveTurn(state, fixture.ruleset, rng)
    // Assert
    expect(result).toStrictEqual(Result.Success(expect.objectContaining({ fleets: expect.any(Object) })))
    expect(rng.getState()).toStrictEqual(before)
    expect(forces(state)).toStrictEqual([{ owner: fixture.owners[0], strength: 10 }])
  })

  it("should rejects an initially illegal moving source while saved journey remains coherent", () => {
    // Arrange
    const fixture = createFleetOperationsScenario({ orders: [{ owner: 1, strength: 30, distance: 5, assault: true }] })
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const journey = Object.values(fixture.state.fleets).find((fleet) => fleet.movement !== undefined)
    const original = fixture.submissions[0]
    Assert.isDefined(journey)
    Assert.isDefined(original)
    const illegal = createSubmittedActionStub({
      ...original,
      id: "NEW-INSTANCE",
      selectedTargets: { craft: journey.id, route: fixture.destination.id },
      selectedInputs: { force: 1 },
    })
    const ruleset = {
      ...fixture.ruleset,
      actionPool: [...fixture.ruleset.actionPool, { id: illegal.id, actionDefinitionId: illegal.actionDefinitionId }],
    }
    const state = { ...structuredClone(fixture.state), turn: 2, submittedActions: [illegal] }
    const before = structuredClone(state)
    // Act
    const result = resolveTurn(state, ruleset, createSeededRng())
    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: expect.arrayContaining([expect.objectContaining({ issue: expect.stringContaining("stationary") })]),
        }),
      ),
    )
    expect(state).toStrictEqual(before)
  })

  it("should return a typed failure for a saved journey missing its submission before an otherwise payable departure", () => {
    // Arrange: both pool instances are valid; only instance0 departs in the first turn.
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 30, distance: 5, assault: true },
        { owner: 1, strength: 10, distance: 5, assault: true },
      ],
      defenders: [],
    })
    const source = Object.values(fixture.state.fleets).find((fleet) => fleet.id === "source-0")
    const first = fixture.submissions[0]
    const second = fixture.submissions[1]
    Assert.isDefined(source)
    Assert.isDefined(first)
    Assert.isDefined(second)
    source.strength = 50
    Reflect.deleteProperty(fixture.state.fleets, "source-1")
    const firstState: TurnState = { ...fixture.state, submittedActions: [first] }
    extractSuccess(resolveTurn(firstState, fixture.ruleset, createSeededRng()))
    const current = createSubmittedActionStub({ ...second, selectedTargets: { craft: source.id, route: fixture.destination.id } })
    const control: TurnState = { ...structuredClone(firstState), turn: 2, submittedActions: [current] }
    const corrupt = structuredClone(control)
    const saved = Object.values(corrupt.fleets).find((fleet) => fleet.movement !== undefined)
    Assert.isDefined(saved)
    Assert.isDefined(saved.movement)
    Reflect.deleteProperty(saved.movement, "submittedAction")
    const before = structuredClone(corrupt)

    // Act: the control proves this new instance10 order is independently legal and payable.
    const controlResult = resolveTurn(control, fixture.ruleset, createSeededRng())
    expect(controlResult).toStrictEqual(Result.Success(expect.objectContaining({ turn: 2, fleets: expect.any(Object) })))
    expect(control.fleets[source.id]?.strength).toBe(10)
    expect(control.players[first.playerId]?.resources).toMatchObject({ INFLUENCE: 90, FUEL: 98 })
    const result = resolveTurn(corrupt, fixture.ruleset, createSeededRng())

    // Assert: malformed saved state is a typed failure before any current payment or departure.
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.FailedToResolvePhases({
          error: ResolvePhaseError.FailedEffect({ error: EffectError.Failed({ error: expect.any(String) }) }),
        }),
      ),
    )
    expect(corrupt).toStrictEqual(before)
  })
})

describe("independent saved strength and whole-tick scheduling", () => {
  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "should fails saved strength %s before a legal payable action",
    (strength) => {
      // Arrange: the untouched fixture has one genuine saved journey and a legal current Gain.
      const { state: control, ruleset } = createCorruptFleetOperationsScenario("none")
      const corrupt = structuredClone(control)
      const journey = Object.values(corrupt.fleets).find((fleet) => fleet.movement !== undefined)
      Assert.isDefined(journey)
      journey.strength = strength
      const before = structuredClone(corrupt)
      // Act
      const controlResult = resolveTurn(control, ruleset, createSeededRng())
      const result = resolveTurn(corrupt, ruleset, createSeededRng())
      // Assert
      expect(controlResult).toStrictEqual(Result.Success(expect.objectContaining({ turn: 2, fleets: expect.any(Object) })))
      expect(result).toStrictEqual(
        Result.Failure(
          ResolveTurnError.FailedToResolvePhases({
            error: ResolvePhaseError.FailedEffect({ error: EffectError.Failed({ error: "Malformed persisted fleet journey" }) }),
          }),
        ),
      )
      expect(corrupt).toStrictEqual(before)
    },
  )

  it("should shuffles the whole tied tick across destinations in literal c,b,a order", () => {
    // Arrange: UUID owner suffixes001/002/003 establish canonical a,b,c. Real prior resolution binds child IDs.
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 10, distance: 2.11, assault: true },
        { owner: 2, strength: 20, distance: 2.19, assault: true },
        { owner: 3, strength: 30, distance: 2.11, assault: true },
      ],
      defenders: [],
    })
    const otherDestination = createPlanetStub({ id: "other-destination", x: 0, y: 0 })
    const third = fixture.state.submittedActions[2]
    Assert.isDefined(third)
    const [firstOrder, secondOrder] = fixture.state.submittedActions
    Assert.isDefined(firstOrder)
    Assert.isDefined(secondOrder)
    const rerouted = { ...third, selectedTargets: { ...third.selectedTargets, route: otherDestination.id } }
    const initialState: TurnState = {
      ...fixture.state,
      planets: { ...fixture.state.planets, [otherDestination.id]: otherDestination },
      submittedActions: [firstOrder, secondOrder, rerouted],
    }
    extractSuccess(resolveTurn(initialState, fixture.ruleset, createSeededRng()))
    const state: TurnState = { ...structuredClone(initialState), turn: 2, submittedActions: [] }
    const reversed = {
      ...structuredClone(state),
      fleets: Object.fromEntries(Object.entries(structuredClone(state.fleets)).toReversed()),
      players: Object.fromEntries(Object.entries(state.players).toReversed()),
      planets: Object.fromEntries(Object.entries(state.planets).toReversed()),
    }
    const contexts: TurnContext[] = [state, reversed].map((turnState) => ({
      arrivalIntents: [],
      destroyedFleetIds: new Set(),
      rng: createSeededRng(1234),
      turnState,
      effectPool: new EffectPool([]),
      ruleset: fixture.ruleset,
    }))
    // Act: exported phases expose actual execution order, rather than final canonical outcome sorting.
    for (const context of contexts) {
      extractSuccess(validateSavedFleets(context))
      extractSuccess(resolveFleetMovementPhase(context))
    }
    const results = contexts.map((context) => resolveFleetCombatPhase(context))
    // Assert: approved seed1234 oracle is c,b,a even though c is at another planet.
    for (const [index, context] of contexts.entries()) {
      expect(results[index]).toStrictEqual(Result.Success(context))
      expect(context.arrivalIntents.map((intent) => intent.tick)).toStrictEqual([2, 2, 2])
      expect(context.effectPool.getOrigins().map((origin) => origin.submittedAction.playerId)).toStrictEqual([
        fixture.owners[2],
        fixture.owners[1],
        fixture.owners[0],
      ])
      expect(context.effectPool.isEmpty()).toBe(true)
      expect(forces(context.turnState)).toStrictEqual([
        { owner: fixture.owners[1], strength: 10 },
        { owner: fixture.owners[2], strength: 30 },
      ])
    }
    expect(contexts[1]?.rng.getState()).toStrictEqual(contexts[0]?.rng.getState())
  })
})

describe("independent actual bindings and stationed defense", () => {
  it("should preserves separate tick2/19 provenance while both saved Assaults bind station37", () => {
    // Arrange: a prior successful resolution supplies canonical saved children and immutable selections.
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 20, distance: 2.11, assault: true },
        { owner: 1, strength: 10, distance: 3.9, assault: true },
      ],
      defenders: [
        { owner: 1, strength: 7, id: "station" },
        { owner: 2, strength: 12, id: "enemy" },
      ],
    })
    extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
    const context: TurnContext = {
      arrivalIntents: [],
      destroyedFleetIds: new Set(),
      rng: createSeededRng(1234),
      turnState: { ...structuredClone(fixture.state), turn: 2, submittedActions: [] },
      effectPool: new EffectPool([]),
      ruleset: fixture.ruleset,
    }
    const [first, second] = fixture.submissions
    Assert.isDefined(first)
    Assert.isDefined(second)
    // Act
    extractSuccess(validateSavedFleets(context))
    const moved = resolveFleetMovementPhase(context)
    const beforeCombat = structuredClone(context.turnState.fleets)
    const intents = structuredClone(context.arrivalIntents)
    const fought = resolveFleetCombatPhase(context)
    // Assert: binding follows station, whereas each original turn/source/strength/tick stays distinct.
    expect(moved).toStrictEqual(Result.Success(context))
    expect(Object.values(beforeCombat).find((fleet) => fleet.id === "station")).toMatchObject({ strength: 37 })
    expect(
      intents.map((intent) => ({
        turn: intent.origin.initiatingTurn,
        order: intent.origin.submittedAction.id,
        selected: intent.origin.submittedAction.selectedInputs,
        source: intent.origin.submittedAction.selectedTargets,
        tick: intent.tick,
        actual: intent.actualFleetId,
      })),
    ).toStrictEqual([
      {
        turn: 1,
        order: "ORDER-0",
        selected: { force: 20 },
        source: { craft: "source-0", route: "destination" },
        tick: 2,
        actual: "station",
      },
      {
        turn: 1,
        order: "ORDER-1",
        selected: { force: 10 },
        source: { craft: "source-1", route: "destination" },
        tick: 19,
        actual: "station",
      },
    ])
    expect(fought).toStrictEqual(Result.Success(context))
    expect(context.turnState.fleets).toStrictEqual({ station: expect.objectContaining({ strength: 25 }) })
    expect(context.effectPool.getOutcomes(first, 1)).toStrictEqual([
      { type: "RESOLVED", result: 'Assault at Planet "destination" exchanged 12 Strength against 12 defending Strength' },
    ])
    expect(context.effectPool.getOutcomes(second, 1)).toStrictEqual([
      { type: "RESOLVED", result: 'Assault at Planet "destination" exchanged 0 Strength against 0 defending Strength' },
    ])
    expect(context.effectPool.isEmpty()).toBe(true)
  })
})

describe("independent alternate seed and enemy transit exclusion", () => {
  it.each([
    {
      seed: 1234,
      order: ["ORDER-1", "ORDER-0", "ORDER-2"],
      persistedState: 1199731377,
      generatorState: 567895707,
      survivor: 10,
      outcomes: [
        'Assault at Planet "destination" exchanged 5 Strength against 15 defending Strength',
        'Assault at Planet "destination" exchanged 20 Strength against 40 defending Strength',
        'Assault at Planet "destination" exchanged 0 Strength against 0 defending Strength',
      ],
    },
    {
      seed: 1,
      order: ["ORDER-0", "ORDER-1", "ORDER-2"],
      persistedState: 1199730144,
      generatorState: 567894474,
      survivor: 8,
      outcomes: [
        'Assault at Planet "destination" exchanged 10 Strength against 50 defending Strength',
        'Assault at Planet "destination" exchanged 16 Strength against 24 defending Strength',
        'Assault at Planet "destination" exchanged 0 Strength against 0 defending Strength',
      ],
    },
  ] as const)(
    "should replays persisted seed$seed with literal execution and arithmetic",
    ({ seed, order, persistedState, generatorState, survivor, outcomes }) => {
      // Arrange: observed exported behavior fixes the two seed oracles; expected values call no shuffle helper.
      const fixture = createFleetOperationsScenario({
        orders: [
          { owner: 1, strength: 10, distance: 2.11, assault: true },
          { owner: 2, strength: 20, distance: 2.19, assault: true },
          { owner: 3, strength: 30, distance: 2.11, assault: true },
        ],
        defenders: [],
      })
      const priorRng = Rng.create(mulberry32Prng(seed))
      extractSuccess(resolveTurn(fixture.state, fixture.ruleset, priorRng))
      const saved = { ...structuredClone(fixture.state), turn: 2, submittedActions: [] }
      const reversed = {
        ...structuredClone(saved),
        fleets: Object.fromEntries(Object.entries(structuredClone(saved.fleets)).toReversed()),
        players: Object.fromEntries(Object.entries(saved.players).toReversed()),
        planets: Object.fromEntries(Object.entries(saved.planets).toReversed()),
      }
      const persistedRng = structuredClone(priorRng.getState())
      expect(JSON.parse(JSON.stringify(persistedRng))).toStrictEqual({ generatorState: persistedState, spareNormal: null })
      const contexts: TurnContext[] = [saved, reversed].map((turnState) => ({
        arrivalIntents: [],
        destroyedFleetIds: new Set(),
        rng: Rng.fromState(persistedRng, mulberry32Prng),
        turnState,
        effectPool: new EffectPool([]),
        ruleset: fixture.ruleset,
      }))
      // Act
      for (const context of contexts) {
        expect(context.rng.getState()).toStrictEqual(persistedRng)
        extractSuccess(validateSavedFleets(context))
        extractSuccess(resolveFleetMovementPhase(context))
        expect(resolveFleetCombatPhase(context)).toStrictEqual(Result.Success(context))
      }
      // Assert: literal snapshots and integer losses differ with the restored order; c survives10 or8.
      for (const context of contexts) {
        expect(context.effectPool.getOrigins().map((origin) => origin.submittedAction.id)).toStrictEqual(order)
        expect(context.arrivalIntents.map((intent) => intent.tick)).toStrictEqual([2, 2, 2])
        expect(forces(context.turnState)).toStrictEqual([{ owner: fixture.owners[2], strength: survivor }])
        expect(fixture.submissions.map((submission) => context.effectPool.getOutcomes(submission, 1))).toStrictEqual(
          outcomes.map((result) => [{ type: "RESOLVED", result }]),
        )
        expect(context.rng.getState()).toStrictEqual({ generatorState, spareNormal: null })
        expect(context.effectPool.isEmpty()).toBe(true)
      }
    },
  )

  it("should excludes a coherent enemy journey originating at the attacked planet from defense", () => {
    // Arrange: the enemy100 departs from destination normally; actual first-turn resolution creates both saved children.
    const fixture = createFleetOperationsScenario({
      orders: [
        { owner: 1, strength: 30, distance: 2.11, assault: true },
        { owner: 2, strength: 100, distance: 10, assault: false },
      ],
      defenders: [{ owner: 2, strength: 20, id: "stationed-enemy" }],
    })
    const [attack, departure] = fixture.submissions
    const enemySource = Object.values(fixture.state.fleets).find((fleet) => fleet.id === "source-1")
    const enemyDestination = Object.values(fixture.state.planets).find((planet) => planet.id === "origin-1")
    Assert.isDefined(attack)
    Assert.isDefined(departure)
    Assert.isDefined(enemySource)
    Assert.isDefined(enemyDestination)
    const initialState: TurnState = {
      ...fixture.state,
      fleets: { ...fixture.state.fleets, [enemySource.id]: { ...enemySource, originPlanetId: fixture.destination.id } },
      submittedActions: [
        attack,
        createSubmittedActionStub({ ...departure, selectedTargets: { craft: enemySource.id, route: enemyDestination.id } }),
      ],
    }
    extractSuccess(resolveTurn(initialState, fixture.ruleset, createSeededRng()))
    const saved = { ...structuredClone(initialState), turn: 2, submittedActions: [] }
    const resourcesBefore = structuredClone(saved.players)
    const context: TurnContext = {
      arrivalIntents: [],
      destroyedFleetIds: new Set(),
      rng: createSeededRng(1234),
      turnState: saved,
      effectPool: new EffectPool([]),
      ruleset: fixture.ruleset,
    }
    // Act
    extractSuccess(validateSavedFleets(context))
    extractSuccess(resolveFleetMovementPhase(context))
    const enemyInTransit = Object.values(saved.fleets).find((fleet) => fleet.movement !== undefined)
    const fought = resolveFleetCombatPhase(context)
    // Assert: including the transit100 would destroy attacker30. Only stationary20 defends, leaving attacker10.
    expect(enemyInTransit).toMatchObject({
      ownerPlayerId: fixture.owners[1],
      originPlanetId: fixture.destination.id,
      destinationPlanetId: enemyDestination.id,
      strength: 100,
      distanceToEnd: 6,
      movement: { speed: 2, initiatingTurn: 1 },
    })
    expect(fought).toStrictEqual(Result.Success(context))
    expect(forces(saved)).toStrictEqual([
      { owner: fixture.owners[0], strength: 10 },
      { owner: fixture.owners[1], strength: 100 },
    ])
    expect(saved.players).toStrictEqual(resourcesBefore)
    expect(context.effectPool.getOutcomes(attack, 1)).toStrictEqual([
      { type: "RESOLVED", result: 'Assault at Planet "destination" exchanged 20 Strength against 20 defending Strength' },
    ])
    expect(context.rng.getState()).toStrictEqual({ generatorState: 1234, spareNormal: null })
    expect(context.effectPool.isEmpty()).toBe(true)
  })
})
