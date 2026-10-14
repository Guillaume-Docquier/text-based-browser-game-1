import { type RngState, Assert } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { required } from "#shared/testing/required.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { PendingArrivalColonizationIntent } from "#shared/turn-resolution/TurnContext.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import {
  PLAYER_A,
  PLAYER_B,
  PLAYER_C,
  runStandaloneColonizeWithMove,
  journeyTo,
  createColonizeMoveAction,
  createMovementAction,
  createRuleset,
  resolve,
  resolveContinuation,
  resolveColonizeOnly,
  intent,
  planet,
  fleet,
  submit,
  outcomeFor,
  outcomesFor,
  fleetAtPlanetForOwner,
  fleetStrengthForOwner,
} from "./fleet-colonization.test-support.ts"

describe("Fleet Colonization", () => {
  it("should leave an ordinary 35-Strength Move beside enemy10 without claiming the unowned Planet", () => {
    // Arrange
    const ordinaryMove = createMovementAction({ id: "TEST_ORDINARY_MOVE_NO_AUTO_COMBAT", speed: 10 })
    const ruleset = createRuleset([ordinaryMove], [{ id: "ORDINARY_MOVE_1", actionDefinitionId: ordinaryMove.id }])
    const origin = planet("ordinary-enemy-origin", PLAYER_A, 0)
    const target = planet("ordinary-enemy-target", null, 1)
    const source = fleet("ordinary-enemy-source", PLAYER_A, origin, 35)
    const enemy = fleet("ordinary-enemy-presence", PLAYER_B, target, 10)
    const action = createSubmittedActionStub({
      id: "ORDINARY_MOVE_1",
      playerId: PLAYER_A,
      actionDefinitionId: ordinaryMove.id,
      selectedTargets: { fleet: source.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })

    // Act
    const resolved = resolve({ planets: [origin, target], fleets: [source, enemy], submissions: [action], ruleset })
    // Assert
    expect(Object.values(resolved.fleets)).toContainEqual(
      expect.objectContaining({
        ownerPlayerId: PLAYER_A,
        originPlanetId: target.id,
        strength: 35,
        arrivedAtTick: 2,
        movement: undefined,
      }),
    )
    expect(resolved.fleets[source.id]).toBeUndefined()
    expect(resolved.fleets[enemy.id]).toMatchObject({ originPlanetId: target.id, strength: 10 })
    expect(required(resolved.planets[target.id]).ownerPlayerId).toBeNull()
    expect(ordinaryMove.effects.map(({ type }) => type)).toStrictEqual(["FLEET_MOVE"])
    expect(outcomesFor(resolved, PLAYER_A, action.id).every(({ type }) => type === "RESOLVED")).toBe(true)
  })

  it("should preserve COLONY7 after success, prevention, and the following empty Turns", () => {
    expect.hasAssertions()

    // Arrange the successful colonization case.

    verifySuccessPlanet()

    // Arrange the prevented colonization case.
    const assaultColonize = createColonizeMoveAction({ id: "TEST_COLONY7_ASSAULT", speed: 1, withAssault: true })
    const ruleset = createRuleset([assaultColonize], [{ id: "COLONY_STOCKPILE_ASSAULT_1", actionDefinitionId: assaultColonize.id }])
    const origin = planet("colony-stockpile-prevention-origin", PLAYER_A, 0)
    const target = planet("colony-stockpile-prevention-target", null, 1)

    verifyAttacker({ origin, target, assaultColonize, ruleset })
  })

  it("should allow Colonization beside an enemy Fleet without implicit combat", () => {
    const origin = planet("no-auto-combat-origin", PLAYER_A, 0)
    const target = planet("no-auto-combat-target", null, 1)
    const source = fleet("no-auto-combat-source", PLAYER_A, origin, 35)
    const defender = fleet("no-auto-combat-defender", PLAYER_B, target, 10)
    const action = submit({
      id: ColonizePlanetTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizePlanetTest.id,
      source,
      target,
      strength: 35,
    })

    const colonization = resolve({ planets: [origin, target], fleets: [source, defender], submissions: [action] })
    expect(colonization.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(fleetStrengthForOwner(colonization, PLAYER_A)).toBe(15)
    expect(required(colonization.fleets[defender.id]).strength).toBe(10)
    expect(outcomesFor(colonization, PLAYER_A, action.id)).not.toContainEqual(
      expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("exchanged") }),
    )
  })

  it.each([
    { attacker: 50, defender: 10, expectedOwner: PLAYER_A, expectedAttacker: 20, expectedDefender: undefined, colonizeType: "RESOLVED" },
    { attacker: 35, defender: 16, expectedOwner: null, expectedAttacker: 19, expectedDefender: undefined, colonizeType: "PREVENTED" },
    {
      attacker: 20,
      defender: 20,
      expectedOwner: null,
      expectedAttacker: undefined,
      expectedDefender: undefined,
      colonizeType: "PREVENTED",
    },
  ])("should apply explicitly configured Assault before Colonization ($attacker vs $defender)", (scenario) => {
    const actionDefinition = createColonizeMoveAction({ id: "TEST_COMPOSED_COLONIZE_ASSAULT", speed: 1, withAssault: true })
    const ruleset = createRuleset([actionDefinition], [{ id: "COMPOSED_1", actionDefinitionId: actionDefinition.id }])
    const origin = planet("composed-origin", PLAYER_A, 0)
    const target = planet("composed-target", null, 1)
    const attacker = fleet("composed-attacker", PLAYER_A, origin, scenario.attacker)
    const defender = fleet("composed-defender", PLAYER_B, target, scenario.defender)
    const action = submit({
      id: "COMPOSED_1",
      playerId: PLAYER_A,
      actionDefinitionId: actionDefinition.id,
      source: attacker,
      target,
      strength: scenario.attacker,
    })
    const resolved = resolve({ planets: [origin, target], fleets: [attacker, defender], submissions: [action], ruleset })

    expect(resolved.planets[target.id]?.ownerPlayerId).toBe(scenario.expectedOwner)
    expect(resolved.fleets[defender.id]).toBeUndefined()
    expect(resolved.fleets[attacker.id]).toBeUndefined()
    expect(fleetStrengthForOwner(resolved, PLAYER_A)).toBe(scenario.expectedAttacker)
    expect(outcomesFor(resolved, PLAYER_A, action.id).some((outcome) => outcome.type === scenario.colonizeType)).toBe(true)
  })

  it("should resolve stationary Colonize Here at tick0 without a journey and remove exact20", () => {
    const origin = planet("stationary-origin", null, 0)
    const fleet35 = fleet("stationary-colonizer-35", PLAYER_A, origin, 35)
    const action35 = createSubmittedActionStub({
      id: ColonizeHereTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: fleet35.id, planet: origin.id },
    })
    const resolved35 = resolve({ planets: [origin], fleets: [fleet35], submissions: [action35] })
    expect(resolved35.planets[origin.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(required(resolved35.fleets[fleet35.id]).strength).toBe(15)
    expect(Object.values(resolved35.fleets).some(({ movement }) => movement !== undefined)).toBe(false)

    const exactOrigin = planet("stationary-exact-origin", null, 0)
    const fleet20 = fleet("stationary-colonizer-20", PLAYER_A, exactOrigin, 20)
    const action20 = createSubmittedActionStub({
      id: ColonizeHereTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: fleet20.id, planet: exactOrigin.id },
    })
    const resolved20 = resolve({ planets: [exactOrigin], fleets: [fleet20], submissions: [action20] })
    expect(resolved20.planets[exactOrigin.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(resolved20.fleets[fleet20.id]).toBeUndefined()
    expect(resolved20.removedFleetIds).toContain(fleet20.id)
  })

  it("should resolve standalone Colonize against the post-Move and post-Assault current force", () => {
    const uncontested = runStandaloneColonizeWithMove(false)
    const uncontestedJourney = journeyTo(uncontested.resolved, uncontested.destination.id)
    Assert.isDefined(uncontestedJourney)
    expect(uncontested.resolved.planets[uncontested.origin.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(uncontested.resolved.fleets[uncontested.source.id]).toBeUndefined()
    expect(uncontestedJourney.strength).toBe(15)
    expect(outcomeFor(uncontested.resolved, PLAYER_A, uncontested.colonize.id).type).toBe("RESOLVED")
    expect(required(uncontested.resolved.players[PLAYER_A]).resources).toMatchObject({
      [ResourceType.INFLUENCE]: 22,
      [ResourceType.FUEL]: 99,
    })

    const weakened = runStandaloneColonizeWithMove(true)
    const weakenedJourney = journeyTo(weakened.resolved, weakened.destination.id)
    Assert.isDefined(weakenedJourney)
    Assert.isDefined(weakened.attacker)
    expect(required(weakened.resolved.planets[weakened.origin.id]).ownerPlayerId).toBeNull()
    expect(required(weakened.resolved.fleets[weakened.source.id]).strength).toBe(19)
    expect(weakened.resolved.fleets[weakened.attacker.id]).toBeUndefined()
    expect(weakenedJourney.strength).toBe(15)
    expect(outcomeFor(weakened.resolved, PLAYER_A, weakened.colonize.id).type).toBe("PREVENTED")
    expect(required(weakened.resolved.players[PLAYER_A]).resources).toMatchObject({
      [ResourceType.INFLUENCE]: 22,
      [ResourceType.FUEL]: 99,
    })
  })

  it("should reject an earlier invalid current force and still let a later eligible arrival claim", () => {
    expect.hasAssertions()

    const target = planet("phase-target", null, 0)
    const originA = planet("phase-origin-a", PLAYER_A, -1)
    const originB = planet("phase-origin-b", PLAYER_B, 1)
    const fleetA = fleet("phase-fleet-a", PLAYER_A, target, 19)
    const fleetB = fleet("phase-fleet-b", PLAYER_B, target, 35)
    const actionA = createSubmittedActionStub({
      id: "PHASE_A",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: fleetA.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const actionB = createSubmittedActionStub({
      id: "PHASE_B",
      playerId: PLAYER_B,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: fleetB.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const colonizeDefinition = FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 })
    const intents = [
      intent({ fleet: fleetA, action: actionA, target, tick: 4, colonizeDefinition }),
      intent({ fleet: fleetB, action: actionB, target, tick: 8, colonizeDefinition }),
    ]
    const rng = createSeededRng(0)
    const before = rng.getState()

    verifyResult({ target, originA, originB, fleetA, fleetB, intents, rng, before, actionA, colonizeDefinition, actionB })
  })

  it("should remove invalid same-tick candidates before arbitration and preserve eligible-only RNG draws", () => {
    expect.hasAssertions()

    const target = planet("invalid-tie-target", null, 0)
    const fleetA = fleet("invalid-tie-a", PLAYER_A, target, 35)
    const fleetB = fleet("invalid-tie-b", PLAYER_B, target, 35)
    const fleetC = fleet("invalid-tie-c", PLAYER_C, target, 19)
    const deadFleet = fleet("invalid-tie-dead", PLAYER_A, target, 35)
    const colonizeDefinition = FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 })
    const actionA = createSubmittedActionStub({ id: "TIE_A", playerId: PLAYER_A, actionDefinitionId: ColonizePlanetTest.id })
    const actionB = createSubmittedActionStub({ id: "TIE_B", playerId: PLAYER_B, actionDefinitionId: ColonizePlanetTest.id })
    const actionC = createSubmittedActionStub({ id: "TIE_C", playerId: PLAYER_C, actionDefinitionId: ColonizePlanetTest.id })
    const deadAction = createSubmittedActionStub({ id: "TIE_DEAD", playerId: PLAYER_A, actionDefinitionId: ColonizePlanetTest.id })
    const intents = [
      intent({ fleet: fleetA, action: actionA, target, tick: 4, colonizeDefinition }),
      intent({ fleet: fleetB, action: actionB, target, tick: 4, colonizeDefinition }),
      intent({ fleet: fleetC, action: actionC, target, tick: 4, colonizeDefinition }),
      intent({ fleet: deadFleet, action: deadAction, target, tick: 4, colonizeDefinition }),
    ]
    const rng = createSeededRng(0)

    verifyCase({ target, fleetA, fleetB, fleetC, intents, rng })

    verifySingletonRng({ deadAction, colonizeDefinition, actionC, actionB })
  })

  it("should keep a legal Colonize journey moving after another player claims its target", () => {
    const originA = planet("claim-transit-origin-a", PLAYER_A, 0)
    const target = planet("claim-transit-target", null, 3.5)
    const fleetA = fleet("claim-transit-fleet-a", PLAYER_A, originA, 50)
    const fleetB = fleet("claim-transit-fleet-b", PLAYER_B, target, 35)
    const departure = resolve({
      planets: [originA, target],
      fleets: [fleetA, fleetB],
      submissions: [
        submit({
          id: ColonizePlanetTest.id + "_1",
          playerId: PLAYER_A,
          actionDefinitionId: ColonizePlanetTest.id,
          source: fleetA,
          target,
          strength: 35,
        }),
      ],
    })
    const journey = Object.values(departure.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(journey)

    const claim = resolveContinuation(departure, 2)
    const claimantAction = createSubmittedActionStub({
      id: ColonizeHereTest.id + "_1",
      playerId: PLAYER_B,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: fleetB.id, planet: target.id },
    })
    const claimantResult = resolveTurn(
      createTurnStateStub({
        gameId: claim.gameId,
        turn: 3,
        submittedActions: [claimantAction],
        players: claim.players,
        planets: claim.planets,
        fleets: structuredClone(claim.fleets),
      }),
      TestRuleset,
      createSeededRng(1234),
    )
    Assert.isSuccess(claimantResult)
    const claimantTurn = claimantResult.value
    expect(claimantTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(required(claimantTurn.players[PLAYER_A]).resources[ResourceType.INFLUENCE]).toBe(25)

    const finalTurn = resolveContinuation(claimantTurn, 4)
    expect(finalTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(finalTurn.fleets[journey.id]).toMatchObject({ originPlanetId: target.id, strength: 35, movement: undefined })
    expect(required(finalTurn.players[PLAYER_A]).resources[ResourceType.INFLUENCE]).toBe(25)
    expect(required(finalTurn.resolvedContinuations[0]).actionOutcomes.at(-1)).toMatchObject({ type: "PREVENTED" })
  })

  it("should use current post-Combat force for a tick4/tick8 full-Turn claimant race", () => {
    const secondColonize = createColonizeMoveAction({ id: "TEST_COLONIZE_SPEED_ONE", speed: 1 })
    const ruleset = createRuleset([secondColonize], [{ id: "SLOW_COLONIZE_1", actionDefinitionId: secondColonize.id }])
    const originA = planet("combat-priority-origin-a", PLAYER_A, 0)
    const target = planet("combat-priority-target", null, 0.2)
    const originB = planet("combat-priority-origin-b", PLAYER_B, -0.2)
    const fleetA = fleet("combat-priority-fleet-a", PLAYER_A, originA, 35)
    const fleetB = fleet("combat-priority-fleet-b", PLAYER_B, originB, 70)
    const attacker = fleet("combat-priority-attacker", PLAYER_C, target, 48)
    const actionA = submit({
      id: ColonizePlanetTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizePlanetTest.id,
      source: fleetA,
      target,
      strength: 35,
    })
    const actionB = submit({
      id: "SLOW_COLONIZE_1",
      playerId: PLAYER_B,
      actionDefinitionId: secondColonize.id,
      source: fleetB,
      target,
      strength: 70,
    })
    const assault = createSubmittedActionStub({
      id: "TEST_STATIONARY_ASSAULT_1",
      playerId: PLAYER_C,
      actionDefinitionId: "TEST_STATIONARY_ASSAULT",
      selectedTargets: { station: attacker.id, battlePlanet: target.id },
    })
    const rng = createSeededRng(0)
    const resolved = resolve({
      planets: [originA, target, originB],
      fleets: [fleetA, fleetB, attacker],
      submissions: [actionA, actionB, assault],
      ruleset,
      rng,
    })

    expect(resolved.planets[target.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(fleetStrengthForOwner(resolved, PLAYER_A)).toBe(19)
    expect(fleetStrengthForOwner(resolved, PLAYER_B)).toBe(18)
    expect(Object.values(resolved.fleets).some(({ ownerPlayerId }) => ownerPlayerId === PLAYER_C)).toBe(false)
    expect(outcomeFor(resolved, PLAYER_A, actionA.id).type).toBe("PREVENTED")
    expect(outcomeFor(resolved, PLAYER_B, actionB.id).type).toBe("RESOLVED")
  })

  it("should keep earlier merged arrival provenance and consume only one merged Colonize reservation", () => {
    expect.hasAssertions()
    const ordinary = createMovementAction({ id: "TEST_ORDINARY_SPEED_TEN", speed: 10 })
    const early = createColonizeMoveAction({ id: "TEST_COLONIZE_SPEED_FOUR", speed: 4 })
    const late = createColonizeMoveAction({ id: "TEST_COLONIZE_SPEED_TWO", speed: 2 })
    const ruleset = createRuleset(
      [ordinary, early, late],
      [
        { id: "ORDINARY_1", actionDefinitionId: ordinary.id },
        { id: "EARLY_1", actionDefinitionId: early.id },
        { id: "LATE_1", actionDefinitionId: late.id },
      ],
    )
    const target = planet("merge-target", null, 1)
    const originOrdinary = planet("merge-ordinary-origin", PLAYER_A, 0)
    const originLate = planet("merge-late-origin", PLAYER_A, 0.2)
    const originEarly = planet("merge-early-origin", PLAYER_B, -0.2)
    const survivor = fleet("merge-survivor", PLAYER_A, target, 10)
    const ordinarySource = fleet("merge-ordinary-source", PLAYER_A, originOrdinary, 15)
    const lateSource = fleet("merge-late-source", PLAYER_A, originLate, 25)
    const earlySource = fleet("merge-early-source", PLAYER_B, originEarly, 45)
    const submissions = [
      submit({ id: "ORDINARY_1", playerId: PLAYER_A, actionDefinitionId: ordinary.id, source: ordinarySource, target, strength: 10 }),
      submit({ id: "LATE_1", playerId: PLAYER_A, actionDefinitionId: late.id, source: lateSource, target, strength: 20 }),
      submit({ id: "EARLY_1", playerId: PLAYER_B, actionDefinitionId: early.id, source: earlySource, target, strength: 35 }),
    ]

    verify({
      target,
      originOrdinary,
      originLate,
      originEarly,
      survivor,
      ordinarySource,
      lateSource,
      earlySource,
      submissions,
      ruleset,
      late,
    })

    assertLaterEnemy({ ordinary, late })
  })

  it("should merge both friendly Colonize arrivals before applying one shared survivor reservation", () => {
    expect.hasAssertions()

    const early = createColonizeMoveAction({ id: "TEST_DUPLICATE_SPEED_FOUR", speed: 4 })
    const late = createColonizeMoveAction({ id: "TEST_DUPLICATE_SPEED_TWO", speed: 2 })
    const ruleset = createRuleset(
      [early, late],
      [
        { id: "DUPLICATE_EARLY_1", actionDefinitionId: early.id },
        { id: "DUPLICATE_LATE_1", actionDefinitionId: late.id },
      ],
    )
    const target = planet("duplicate-target", null, 1)
    const originEarly = planet("duplicate-origin-early", PLAYER_A, 0.2)
    const originLate = planet("duplicate-origin-late", PLAYER_A, 1.8)
    const survivor = fleet("duplicate-survivor", PLAYER_A, target, 10)
    const sourceEarly = fleet("duplicate-source-early", PLAYER_A, originEarly, 25)
    const sourceLate = fleet("duplicate-source-late", PLAYER_A, originLate, 25)
    const submissions = [
      submit({ id: "DUPLICATE_EARLY_1", playerId: PLAYER_A, actionDefinitionId: early.id, source: sourceEarly, target, strength: 20 }),
      submit({ id: "DUPLICATE_LATE_1", playerId: PLAYER_A, actionDefinitionId: late.id, source: sourceLate, target, strength: 20 }),
    ]

    verify2({ target, originEarly, originLate, survivor, sourceEarly, sourceLate, submissions, ruleset })

    verifyLateTickTarget({ late })
  })
})

function verify(input: VerifyInput): void {
  const resolved = resolve({
    ...input,
    planets: [input.target, input.originOrdinary, input.originLate, input.originEarly],
    fleets: [input.survivor, input.ordinarySource, input.lateSource, input.earlySource],
  })

  assert({ ...input, resolved })

  const lateTickTarget = planet("merge-late-tick-target", null, 1)
  const lateTickOrigin = planet("merge-late-tick-origin", PLAYER_A, 0.2)
  const lateTickSource = fleet("merge-late-tick-source", PLAYER_A, lateTickOrigin, 25)
  const lateTickRuleset = createRuleset([input.late], [{ id: "LATE_TICK_ONLY_1", actionDefinitionId: input.late.id }])
  const lateTickResolved = resolve({
    planets: [lateTickOrigin, lateTickTarget],
    fleets: [lateTickSource],
    submissions: [
      submit({
        id: "LATE_TICK_ONLY_1",
        playerId: PLAYER_A,
        actionDefinitionId: input.late.id,
        source: lateTickSource,
        target: lateTickTarget,
        strength: 25,
      }),
    ],
    ruleset: lateTickRuleset,
  })
  expect(fleetAtPlanetForOwner(lateTickResolved, lateTickTarget.id, PLAYER_A)).toMatchObject({
    strength: 5,
    arrivedAtTick: 8,
  })
}

function assert(input: AssertInput): void {
  expect(input.resolved.planets[input.target.id]?.ownerPlayerId).toBe(PLAYER_B)
  expect(input.resolved.fleets[input.survivor.id]).toMatchObject({
    id: input.survivor.id,
    name: input.survivor.name,
    strength: 40,
    originPlanetId: input.target.id,
    arrivedAtTick: 2,
  })
  expect(fleetAtPlanetForOwner(input.resolved, input.target.id, PLAYER_B)).toMatchObject({ strength: 15, arrivedAtTick: 6 })
  expect(required(input.resolved.fleets[input.ordinarySource.id]).strength).toBe(5)
  expect(required(input.resolved.fleets[input.lateSource.id]).strength).toBe(5)
  expect(required(input.resolved.fleets[input.earlySource.id]).strength).toBe(10)
  expect(
    Object.values(input.resolved.fleets)
      .filter(({ ownerPlayerId }) => ownerPlayerId === PLAYER_B)
      .map(({ strength }) => strength)
      .toSorted((first, second) => first - second),
  ).toStrictEqual([10, 15])
  expect(input.resolved.removedFleetIds).toHaveLength(2)
  expect(outcomeFor(input.resolved, PLAYER_B, "EARLY_1").type).toBe("RESOLVED")
  expect(outcomeFor(input.resolved, PLAYER_A, "LATE_1").type).toBe("PREVENTED")
}

function assertLaterEnemy(input: AssertLaterEnemyInput): void {
  const laterEnemy = createColonizeMoveAction({ id: "TEST_COLONIZE_SPEED_ONE_CONTROL", speed: 1 })
  const laterRuleset = createRuleset(
    [input.ordinary, input.late, laterEnemy],
    [
      { id: "ORDINARY_CONTROL_1", actionDefinitionId: input.ordinary.id },
      { id: "LATE_FRIENDLY_1", actionDefinitionId: input.late.id },
      { id: "LATER_ENEMY_1", actionDefinitionId: laterEnemy.id },
    ],
  )
  const laterTarget = planet("merge-control-target", null, 1)
  const laterOriginOrdinary = planet("merge-control-ordinary-origin", PLAYER_A, 0)
  const laterOriginFriendly = planet("merge-control-friendly-origin", PLAYER_A, 0.2)
  const laterOriginEnemy = planet("merge-control-enemy-origin", PLAYER_B, 0.5)
  const laterSurvivor = fleet("merge-control-survivor", PLAYER_A, laterTarget, 10)
  const laterOrdinarySource = fleet("merge-control-ordinary", PLAYER_A, laterOriginOrdinary, 15)
  const laterFriendlySource = fleet("merge-control-friendly", PLAYER_A, laterOriginFriendly, 25)
  const laterEnemySource = fleet("merge-control-enemy", PLAYER_B, laterOriginEnemy, 45)
  const laterResolved = resolve({
    planets: [laterTarget, laterOriginOrdinary, laterOriginFriendly, laterOriginEnemy],
    fleets: [laterSurvivor, laterOrdinarySource, laterFriendlySource, laterEnemySource],
    ruleset: laterRuleset,
    submissions: [
      submit({
        id: "ORDINARY_CONTROL_1",
        playerId: PLAYER_A,
        actionDefinitionId: input.ordinary.id,
        source: laterOrdinarySource,
        target: laterTarget,
        strength: 10,
      }),
      submit({
        id: "LATE_FRIENDLY_1",
        playerId: PLAYER_A,
        actionDefinitionId: input.late.id,
        source: laterFriendlySource,
        target: laterTarget,
        strength: 20,
      }),
      submit({
        id: "LATER_ENEMY_1",
        playerId: PLAYER_B,
        actionDefinitionId: laterEnemy.id,
        source: laterEnemySource,
        target: laterTarget,
        strength: 35,
      }),
    ],
  })
  expect(laterResolved.planets[laterTarget.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(laterResolved.fleets[laterSurvivor.id]).toMatchObject({ strength: 20, arrivedAtTick: 2 })
  expect(fleetAtPlanetForOwner(laterResolved, laterTarget.id, PLAYER_B)).toMatchObject({ strength: 35, arrivedAtTick: 10 })
  expect(required(laterResolved.fleets[laterEnemySource.id]).strength).toBe(10)
  expect(
    Object.values(laterResolved.fleets)
      .filter(({ ownerPlayerId }) => ownerPlayerId === PLAYER_B)
      .map(({ strength }) => strength)
      .toSorted((first, second) => first - second),
  ).toStrictEqual([10, 35])
  expect(outcomeFor(laterResolved, PLAYER_A, "LATE_FRIENDLY_1").type).toBe("RESOLVED")
  expect(outcomeFor(laterResolved, PLAYER_B, "LATER_ENEMY_1").type).toBe("PREVENTED")
}

type VerifyInput = {
  target: ReturnType<typeof createPlanetStub>
  originOrdinary: ReturnType<typeof createPlanetStub>
  originLate: ReturnType<typeof createPlanetStub>
  originEarly: ReturnType<typeof createPlanetStub>
  survivor: ReturnType<typeof createFleetStub>
  ordinarySource: ReturnType<typeof createFleetStub>
  lateSource: ReturnType<typeof createFleetStub>
  earlySource: ReturnType<typeof createFleetStub>
  submissions: Array<
    Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
  >
  ruleset: Ruleset
  late: ReturnType<typeof createActionDefinitionStub>
}

type AssertInput = {
  resolved: ResolvedTurnState
  target: ReturnType<typeof createPlanetStub>
  survivor: ReturnType<typeof createFleetStub>
  ordinarySource: ReturnType<typeof createFleetStub>
  lateSource: ReturnType<typeof createFleetStub>
  earlySource: ReturnType<typeof createFleetStub>
}

type AssertLaterEnemyInput = {
  ordinary: ReturnType<typeof createActionDefinitionStub>
  late: ReturnType<typeof createActionDefinitionStub>
}

function verifySuccessPlanet(): void {
  const successPlanet = planet("colony-stockpile-success", null, 0)
  const successfulFleet = fleet("colony-stockpile-success-force", PLAYER_A, successPlanet, 35)
  const successfulAction = createSubmittedActionStub({
    id: ColonizeHereTest.id + "_1",
    playerId: PLAYER_A,
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: successfulFleet.id, planet: successPlanet.id },
    selectedInputs: {},
  })
  // Act
  const success = resolve({
    planets: [successPlanet],
    fleets: [successfulFleet],
    submissions: [successfulAction],
    colonyStockpile: 7,
  })
  // Assert
  expect(success.planets[successPlanet.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(required(success.fleets[successfulFleet.id]).strength).toBe(15)
  expect(required(success.players[PLAYER_A]).resources[ResourceType.COLONY]).toBe(7)
  // Act: resolve the following empty Turn.
  const successEmptyTurn = resolveContinuation(success, 2)
  // Assert the owner, remaining strength, and stockpile persist.
  expect(successEmptyTurn.planets[successPlanet.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(required(successEmptyTurn.fleets[successfulFleet.id]).strength).toBe(15)
  expect(required(successEmptyTurn.players[PLAYER_A]).resources[ResourceType.COLONY]).toBe(7)
}

function verifyAttacker(input: VerifyAttackerInput): void {
  const attacker = fleet("colony-stockpile-prevention-attacker", PLAYER_A, input.origin, 35)
  const defender = fleet("colony-stockpile-prevention-defender", PLAYER_B, input.target, 16)
  const attack = submit({
    id: "COLONY_STOCKPILE_ASSAULT_1",
    playerId: PLAYER_A,
    actionDefinitionId: input.assaultColonize.id,
    source: attacker,
    target: input.target,
    strength: 35,
  })
  // Act
  const prevention = resolve({
    planets: [input.origin, input.target],
    fleets: [attacker, defender],
    submissions: [attack],
    ruleset: input.ruleset,
    colonyStockpile: 7,
  })
  // Assert combat leaves 19, does not claim, and preserves COLONY7.
  expect(required(prevention.planets[input.target.id]).ownerPlayerId).toBeNull()
  expect(fleetStrengthForOwner(prevention, PLAYER_A)).toBe(19)
  expect(prevention.fleets[defender.id]).toBeUndefined()
  expect(outcomesFor(prevention, PLAYER_A, attack.id)).toContainEqual(
    expect.objectContaining({ type: "PREVENTED", reason: expect.stringContaining("below the 20 required") }),
  )
  expect(required(prevention.players[PLAYER_A]).resources[ResourceType.COLONY]).toBe(7)
  // Act: resolve the following empty Turn.
  const preventionEmptyTurn = resolveContinuation(prevention, 2, createSeededRng(1234), input.ruleset)
  // Assert the prevented owner, surviving force, and stockpile persist.
  expect(required(preventionEmptyTurn.planets[input.target.id]).ownerPlayerId).toBeNull()
  expect(fleetStrengthForOwner(preventionEmptyTurn, PLAYER_A)).toBe(19)
  expect(required(preventionEmptyTurn.players[PLAYER_A]).resources[ResourceType.COLONY]).toBe(7)
}

function verifyResult(input: VerifyResultInput): void {
  const result = resolveColonizeOnly({
    ...input,
    planets: [input.target, input.originA, input.originB],
    fleets: [input.fleetA, input.fleetB],
  })

  expect(result.context.turnState.planets[input.target.id]?.ownerPlayerId).toBe(PLAYER_B)
  expect(required(result.context.turnState.fleets[input.fleetA.id]).strength).toBe(19)
  expect(required(result.context.turnState.fleets[input.fleetB.id]).strength).toBe(15)
  expect(required(input.intents[0]).actionOutcomes.at(-1)).toMatchObject({
    type: "PREVENTED",
    reason: "Fleet has 19 Strength, below the 20 required to colonize",
  })
  expect(required(input.intents[1]).actionOutcomes.at(-1)).toMatchObject({ type: "RESOLVED" })
  expect(input.rng.getState()).toStrictEqual(input.before)

  const deadTarget = planet("phase-dead-target", null, 0)
  const deadFleetB = fleet("phase-dead-valid-b", PLAYER_B, deadTarget, 35)
  const deadIntents = [
    intent({ fleet: input.fleetA, action: input.actionA, target: deadTarget, tick: 4, colonizeDefinition: input.colonizeDefinition }),
    intent({ fleet: deadFleetB, action: input.actionB, target: deadTarget, tick: 8, colonizeDefinition: input.colonizeDefinition }),
  ]
  const deadRng = createSeededRng(0)
  const deadRngBefore = deadRng.getState()
  const dead = resolveColonizeOnly({ planets: [deadTarget], fleets: [deadFleetB], intents: deadIntents, rng: deadRng })
  expect(dead.context.turnState.fleets[input.fleetA.id]).toBeUndefined()
  expect(required(dead.context.turnState.fleets[deadFleetB.id]).strength).toBe(15)
  expect(required(deadIntents[0]).actionOutcomes.at(-1)).toMatchObject({
    type: "PREVENTED",
    reason: expect.stringContaining("destroyed before colonization"),
  })
  expect(required(deadIntents[1]).actionOutcomes.at(-1)).toMatchObject({ type: "RESOLVED" })
  expect(deadRng.getState()).toStrictEqual(deadRngBefore)
  expect(dead.context.turnState.planets[deadTarget.id]?.ownerPlayerId).toBe(PLAYER_B)
}

function verifyCase(input: VerifyCaseInput): void {
  const resolved = resolveColonizeOnly({ ...input, planets: [input.target], fleets: [input.fleetA, input.fleetB, input.fleetC] })

  expect(resolved.context.turnState.planets[input.target.id]?.ownerPlayerId).toBe(PLAYER_B)
  expect(required(resolved.context.turnState.fleets[input.fleetA.id]).strength).toBe(35)
  expect(required(resolved.context.turnState.fleets[input.fleetB.id]).strength).toBe(15)
  expect(required(resolved.context.turnState.fleets[input.fleetC.id]).strength).toBe(19)
  expect(required(input.intents[0]).actionOutcomes.at(-1)).toMatchObject({ type: "PREVENTED" })
  expect(required(input.intents[1]).actionOutcomes.at(-1)).toMatchObject({ type: "RESOLVED" })
  expect(required(input.intents[2]).actionOutcomes.at(-1)).toMatchObject({
    type: "PREVENTED",
    reason: "Fleet has 19 Strength, below the 20 required to colonize",
  })
  expect(required(input.intents[3]).actionOutcomes.at(-1)).toMatchObject({
    type: "PREVENTED",
    reason: expect.stringContaining("destroyed before colonization"),
  })
  expect(input.rng.getState()).toStrictEqual({ generatorState: 1831565813, spareNormal: null })
}

function verifySingletonRng(input: VerifySingletonRngInput): void {
  const singletonRng = createSeededRng(0)
  const singletonTarget = planet("invalid-singleton-target", null, 0)
  const singletonFleetB = fleet("invalid-singleton-b", PLAYER_B, singletonTarget, 35)
  const singletonFleetC = fleet("invalid-singleton-c", PLAYER_C, singletonTarget, 19)
  const singletonDeadFleet = fleet("invalid-singleton-dead", PLAYER_A, singletonTarget, 35)
  const singletonIntents = [
    intent({
      fleet: singletonDeadFleet,
      action: input.deadAction,
      target: singletonTarget,
      tick: 4,
      colonizeDefinition: input.colonizeDefinition,
    }),
    intent({
      fleet: singletonFleetC,
      action: input.actionC,
      target: singletonTarget,
      tick: 4,
      colonizeDefinition: input.colonizeDefinition,
    }),
    intent({
      fleet: singletonFleetB,
      action: input.actionB,
      target: singletonTarget,
      tick: 4,
      colonizeDefinition: input.colonizeDefinition,
    }),
  ]
  const singleton = resolveColonizeOnly({
    planets: [singletonTarget],
    fleets: [singletonFleetB, singletonFleetC],
    intents: singletonIntents,
    rng: singletonRng,
  })
  expect(singleton.context.turnState.planets[singletonTarget.id]?.ownerPlayerId).toBe(PLAYER_B)
  expect(required(singleton.context.turnState.fleets[singletonFleetB.id]).strength).toBe(15)
  expect(required(singletonIntents[0]).actionOutcomes.at(-1)).toMatchObject({
    type: "PREVENTED",
    reason: expect.stringContaining("destroyed before colonization"),
  })
  expect(required(singletonIntents[1]).actionOutcomes.at(-1)).toMatchObject({
    type: "PREVENTED",
    reason: "Fleet has 19 Strength, below the 20 required to colonize",
  })
  expect(required(singletonIntents[2]).actionOutcomes.at(-1)).toMatchObject({ type: "RESOLVED" })
  expect(singletonRng.getState()).toStrictEqual({ generatorState: 0, spareNormal: null })
}

function verify2(input: Verify2Input): void {
  const resolved = resolve({
    ...input,
    planets: [input.target, input.originEarly, input.originLate],
    fleets: [input.survivor, input.sourceEarly, input.sourceLate],
  })
  const reversed = resolve({
    planets: [input.target, input.originEarly, input.originLate].toReversed(),
    fleets: [input.survivor, input.sourceEarly, input.sourceLate].toReversed(),
    submissions: input.submissions.toReversed(),
    ruleset: input.ruleset,
  })
  expect(resolved.planets[input.target.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(resolved.fleets[input.survivor.id]).toMatchObject({ strength: 30, arrivedAtTick: 4 })
  expect(required(resolved.fleets[input.sourceEarly.id]).strength).toBe(5)
  expect(required(resolved.fleets[input.sourceLate.id]).strength).toBe(5)
  expect(resolved.removedFleetIds).toHaveLength(2)
  expect(outcomeFor(resolved, PLAYER_A, "DUPLICATE_EARLY_1").type).toBe("RESOLVED")
  expect(outcomeFor(resolved, PLAYER_A, "DUPLICATE_LATE_1").type).toBe("PREVENTED")
  expect(reversed.planets[input.target.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(required(reversed.fleets[input.survivor.id]).strength).toBe(30)
  expect(outcomeFor(reversed, PLAYER_A, "DUPLICATE_EARLY_1")).toStrictEqual(outcomeFor(resolved, PLAYER_A, "DUPLICATE_EARLY_1"))
}

function verifyLateTickTarget(input: VerifyLateTickTargetInput): void {
  const lateTickTarget = planet("duplicate-late-tick-target", null, 1)
  const lateTickOrigin = planet("duplicate-late-tick-origin", PLAYER_A, 1.8)
  const lateTickSource = fleet("duplicate-late-tick-source", PLAYER_A, lateTickOrigin, 25)
  const lateTickRuleset = createRuleset([input.late], [{ id: "DUPLICATE_LATE_TICK_1", actionDefinitionId: input.late.id }])
  const lateTickResolved = resolve({
    planets: [lateTickOrigin, lateTickTarget],
    fleets: [lateTickSource],
    submissions: [
      submit({
        id: "DUPLICATE_LATE_TICK_1",
        playerId: PLAYER_A,
        actionDefinitionId: input.late.id,
        source: lateTickSource,
        target: lateTickTarget,
        strength: 25,
      }),
    ],
    ruleset: lateTickRuleset,
  })
  expect(fleetAtPlanetForOwner(lateTickResolved, lateTickTarget.id, PLAYER_A)).toMatchObject({
    strength: 5,
    arrivedAtTick: 8,
  })
}

type VerifyAttackerInput = {
  origin: ReturnType<typeof createPlanetStub>
  target: ReturnType<typeof createPlanetStub>
  assaultColonize: ReturnType<typeof createActionDefinitionStub>
  ruleset: Ruleset
}

type VerifyResultInput = {
  target: ReturnType<typeof createPlanetStub>
  originA: ReturnType<typeof createPlanetStub>
  originB: ReturnType<typeof createPlanetStub>
  fleetA: ReturnType<typeof createFleetStub>
  fleetB: ReturnType<typeof createFleetStub>
  intents: PendingArrivalColonizationIntent[]
  rng: ReturnType<typeof createSeededRng>
  before: RngState<unknown>
  actionA: ReturnType<typeof createSubmittedActionStub>
  colonizeDefinition: {
    type: "FLEET_COLONIZE"
    targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
    parameters: { strengthRequirement: PositiveInteger }
  }
  actionB: ReturnType<typeof createSubmittedActionStub>
}

type VerifyCaseInput = {
  target: ReturnType<typeof createPlanetStub>
  fleetA: ReturnType<typeof createFleetStub>
  fleetB: ReturnType<typeof createFleetStub>
  fleetC: ReturnType<typeof createFleetStub>
  intents: PendingArrivalColonizationIntent[]
  rng: ReturnType<typeof createSeededRng>
}

type VerifySingletonRngInput = {
  deadAction: ReturnType<typeof createSubmittedActionStub>
  colonizeDefinition: {
    type: "FLEET_COLONIZE"
    targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
    parameters: { strengthRequirement: PositiveInteger }
  }
  actionC: ReturnType<typeof createSubmittedActionStub>
  actionB: ReturnType<typeof createSubmittedActionStub>
}

type Verify2Input = {
  target: ReturnType<typeof createPlanetStub>
  originEarly: ReturnType<typeof createPlanetStub>
  originLate: ReturnType<typeof createPlanetStub>
  survivor: ReturnType<typeof createFleetStub>
  sourceEarly: ReturnType<typeof createFleetStub>
  sourceLate: ReturnType<typeof createFleetStub>
  submissions: Array<
    Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
  >
  ruleset: Ruleset
}

type VerifyLateTickTargetInput = { late: ReturnType<typeof createActionDefinitionStub> }
