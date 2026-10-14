import { type Success, Assert, indexBy } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { StationaryAssaultTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import {
  PLAYER_A,
  PLAYER_B,
  PLAYER_C,
  SpeedTwoAttackMoveTest,
  SpeedTwoAttackMoveRuleset,
  createPooledAssaultScenario,
  resolve,
  planet,
  fleet,
  attackMove,
  ownerStrengths,
  lastOutcome,
} from "./fleet-assault.test-support.ts"

describe("Fleet Assault", () => {
  it("should use ordinal ordering for mixed-case and punctuation pooled IDs before the seeded Assault shuffle", () => {
    // Arrange
    const battle = createPlanetStub({
      id: "mixed-case-battle",
      ownerPlayerId: PLAYER_A,
      name: "Canonical Battle",
      x: 0,
      y: 0,
    })
    const forwardAttacker = fleet("mixed-attacker", PLAYER_A, battle, 30)
    const forwardDefender = fleet("mixed-defender", PLAYER_B, battle, 20)
    const reversedAttacker = fleet("mixed-attacker", PLAYER_A, battle, 30)
    const reversedDefender = fleet("mixed-defender", PLAYER_B, battle, 20)
    const ruleset = Ruleset.create({
      ...TestRuleset,
      actionPool: [
        ...TestRuleset.actionPool,
        { id: "B!", actionDefinitionId: StationaryAssaultTest.id },
        { id: "a:", actionDefinitionId: StationaryAssaultTest.id },
      ],
    })
    const bSubmission = createSubmittedActionStub({
      id: "B!",
      playerId: PLAYER_A,
      actionDefinitionId: StationaryAssaultTest.id,
      selectedTargets: { station: "mixed-attacker", battlePlanet: battle.id },
    })
    const aSubmission = createSubmittedActionStub({
      id: "a:",
      playerId: PLAYER_A,
      actionDefinitionId: StationaryAssaultTest.id,
      selectedTargets: { station: "mixed-attacker", battlePlanet: battle.id },
    })
    // Act
    const forwardRng = createSeededRng(1234)
    const reversedRng = createSeededRng(1234)
    const forward = resolve({
      planets: [battle],
      fleets: [forwardAttacker, forwardDefender],
      submissions: [bSubmission, aSubmission],
      rng: forwardRng,
      ruleset,
    })
    const reversed = resolve({
      planets: [battle],
      fleets: [reversedDefender, reversedAttacker],
      submissions: [aSubmission, bSubmission],
      rng: reversedRng,
      ruleset,
    })

    // Assert
    for (const { result, attacker, defender } of [
      { result: forward, attacker: forwardAttacker, defender: forwardDefender },
      { result: reversed, attacker: reversedAttacker, defender: reversedDefender },
    ]) {
      expect(result.fleets[attacker.id]?.strength).toBe(10)
      expect(result.fleets[defender.id]).toBeUndefined()
      expect(lastOutcome(result, PLAYER_A, "a:")).toMatchObject({
        type: "RESOLVED",
        result: 'Fleet "mixed-attacker-name" exchanged 20 Strength with 20 enemy Strength at Planet "Canonical Battle"',
      })
      expect(lastOutcome(result, PLAYER_A, "B!")).toMatchObject({
        type: "RESOLVED",
        result: 'Fleet "mixed-attacker-name" found no enemy Fleets at Planet "Canonical Battle"',
      })
      expect(result.removedFleetIds).toStrictEqual([defender.id])
    }
    expect(forwardRng.getState()).toStrictEqual({ generatorState: 1831567047, spareNormal: null })
    expect(reversedRng.getState()).toStrictEqual({ generatorState: 1831567047, spareNormal: null })
  })

  it("should resolve same pooled Action IDs in the literal seeded A30/B20 order under row and Fleet permutations", () => {
    // Arrange
    const originA = planet("pooled-origin-a", PLAYER_A, 0)
    const originB = planet("pooled-origin-b", PLAYER_B, 0)
    const target = planet("pooled-target", PLAYER_C, 0.25)
    const attackerA = fleet("pooled-attacker-a", PLAYER_A, originA, 30)
    const attackerB = fleet("pooled-attacker-b", PLAYER_B, originB, 20)
    const submissionA = attackMove(PLAYER_A, attackerA, target, 30)
    const submissionB = attackMove(PLAYER_B, attackerB, target, 20)
    const firstDraw = createSeededRng(1234).float()
    const forwardRng = createSeededRng(1234)
    const reversedRng = createSeededRng(1234)

    // Act
    const forward = resolve({
      planets: [originA, originB, target],
      fleets: [attackerA, attackerB],
      submissions: [submissionA, submissionB],
      rng: forwardRng,
    })
    const reversed = resolve({
      planets: [target, originB, originA],
      fleets: [attackerB, attackerA],
      submissions: [submissionB, submissionA],
      rng: reversedRng,
    })

    // Assert
    expect(submissionA.id).toBe(submissionB.id)
    expect(firstDraw).toBe(0.07329497812315822)
    for (const result of [forward, reversed]) {
      expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([10])
      expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([])
      expect(result.resolvedActions).toHaveLength(2)
      expect(lastOutcome(result, PLAYER_B, submissionB.id)).toMatchObject({
        type: "RESOLVED",
        result: 'Fleet "pooled-attacker-b-name" exchanged 20 Strength with 30 enemy Strength at Planet "planet-pooled-t"',
      })
      expect(lastOutcome(result, PLAYER_A, submissionA.id)).toMatchObject({
        type: "RESOLVED",
        result: 'Fleet "pooled-attacker-a-name" found no enemy Fleets at Planet "planet-pooled-t"',
      })
      expect(result.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(95)
      expect(result.players[PLAYER_A]?.resources[ResourceType.FUEL]).toBe(99)
      expect(result.players[PLAYER_B]?.resources[ResourceType.INFLUENCE]).toBe(95)
      expect(result.players[PLAYER_B]?.resources[ResourceType.FUEL]).toBe(99)
    }
    expect(forwardRng.getState()).toStrictEqual({ generatorState: 1831567047, spareNormal: null })
    expect(reversedRng.getState()).toStrictEqual({ generatorState: 1831567047, spareNormal: null })
  })

  it("should resolve stationary A30/B20 pooled Assaults in the literal seed1234 tick-zero order", () => {
    // Arrange
    const firstDraw = createSeededRng(1234).float()
    const forwardRng = createSeededRng(1234)
    const reversedRng = createSeededRng(1234)
    const forwardFixture = createPooledAssaultScenario()
    const reversedFixture = createPooledAssaultScenario()

    // Act: preserve identical content while permuting both persisted row and submission order.
    const forward = resolve({
      planets: [forwardFixture.target],
      fleets: [forwardFixture.attackerA, forwardFixture.attackerB],
      submissions: [forwardFixture.submissionA, forwardFixture.submissionB],
      rng: forwardRng,
    })
    const reversed = resolve({
      planets: [reversedFixture.target],
      fleets: [reversedFixture.attackerB, reversedFixture.attackerA],
      submissions: [reversedFixture.submissionB, reversedFixture.submissionA],
      rng: reversedRng,
    })

    // Assert
    expect(forwardFixture.submissionA.id).toBe(forwardFixture.submissionB.id)
    expect(reversedFixture.submissionA.id).toBe(reversedFixture.submissionB.id)
    expect(firstDraw).toBe(0.07329497812315822)
    for (const { result, fixture } of [
      { result: forward, fixture: forwardFixture },
      { result: reversed, fixture: reversedFixture },
    ]) {
      expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([10])
      expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([])
      expect(result.resolvedActions).toHaveLength(2)
      expect(lastOutcome(result, PLAYER_B, fixture.submissionB.id)).toStrictEqual({
        type: "RESOLVED",
        result: 'Fleet "pooled-attacker-b-name" exchanged 20 Strength with 30 enemy Strength at Planet "planet-pooled-t"',
      })
      expect(lastOutcome(result, PLAYER_A, fixture.submissionA.id)).toStrictEqual({
        type: "RESOLVED",
        result: 'Fleet "pooled-attacker-a-name" found no enemy Fleets at Planet "planet-pooled-t"',
      })
      expect(result.removedFleetIds).toContain(fixture.attackerB.id)
      expect(result.removedFleetIds).not.toContain(fixture.attackerA.id)
    }
    expect(forwardRng.getState()).toStrictEqual({ generatorState: 1831567047, spareNormal: null })
    expect(reversedRng.getState()).toStrictEqual({ generatorState: 1831567047, spareNormal: null })
  })

  it("should reload the exact 5I/1F speed-two Attack Move until distance five arrives once", () => {
    // Arrange

    const targetSetup1 = createTargetSetup()
    const { firstJourney } = targetSetup1

    const thirdSetup2 = createThirdSetup({ ...targetSetup1 })
    const { third, fourth } = thirdSetup2
    expect(third.value.resolvedContinuations[0]?.actionOutcomes.at(-1)).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("exchanged 20 Strength with 20 enemy Strength"),
    })
    expect(fourth.value.fleets[firstJourney.id]?.strength).toBe(10)
    expect(fourth.value.fleets[firstJourney.id]?.movement).toBeUndefined()
    expect(fourth.value.resolvedContinuations).toHaveLength(0)
  })

  it("should merge the exact speed-two 5I/1F Assault into its named friendly survivor", () => {
    // Arrange
    const origin = planet("friendly-speed-two-origin", PLAYER_A, 0)
    const target = planet("friendly-speed-two-target", PLAYER_B, 5)
    const attacker = fleet("friendly-speed-two-attacker", PLAYER_A, origin, 50)
    const defender = fleet("friendly-speed-two-defender", PLAYER_B, target, 20)
    const friendly = createFleetStub({
      id: "friendly-speed-two-survivor",
      ownerPlayerId: PLAYER_A,
      originPlanetId: target.id,
      name: "Home Guard",
      strength: 7,
    })
    const submission = createSubmittedActionStub({
      id: SpeedTwoAttackMoveTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: SpeedTwoAttackMoveTest.id,
      selectedTargets: { fleet: attacker.id, planet: target.id },
      selectedInputs: { strength: 30 },
    })

    // Act
    const first = resolve({
      planets: [origin, target],
      fleets: [attacker, defender, friendly],
      submissions: [submission],
      ruleset: SpeedTwoAttackMoveRuleset,
    })
    const firstJourney = Object.values(first.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(firstJourney)

    // Continue resolving after each persisted JSON reload.
    const second = resolveTurn(
      createTurnStateStub({
        turn: 2,
        players: first.players,
        planets: first.planets,
        fleets: indexBy(
          "id",
          Object.values(first.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue)))),
        ),
      }),
      SpeedTwoAttackMoveRuleset,
      createSeededRng(),
    )
    Assert.isSuccess(second)
    const third = resolveTurn(
      createTurnStateStub({
        turn: 3,
        players: second.value.players,
        planets: second.value.planets,
        fleets: indexBy(
          "id",
          Object.values(second.value.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue)))),
        ),
      }),
      SpeedTwoAttackMoveRuleset,
      createSeededRng(),
    )
    Assert.isSuccess(third)

    // Assert
    expect(firstJourney).toMatchObject({ strength: 30, distanceToEnd: 3 })
    expect(second.value.fleets[defender.id]?.strength).toBe(20)
    expect(third.value.fleets[defender.id]).toBeUndefined()
    expect(third.value.fleets[friendly.id]).toMatchObject({
      id: friendly.id,
      name: "Home Guard",
      strength: 17,
      originPlanetId: target.id,
    })
    expect(third.value.fleets[firstJourney.id]).toBeUndefined()
    expect(third.value.removedFleetIds).toContain(firstJourney.id)
    expect(third.value.resolvedContinuations).toHaveLength(1)
  })

  it("should replay canonical pooled Action Id ties through the seeded shuffle", () => {
    // Arrange
    const originA = planet("rng-origin-a", PLAYER_A, 0)
    const originB = planet("rng-origin-b", PLAYER_B, 0)
    const target = planet("rng-target", PLAYER_C, 0.25)
    const attackerA = fleet("rng-attacker-a", PLAYER_A, originA, 10)
    const attackerB = fleet("rng-attacker-b", PLAYER_B, originB, 20)
    // Act
    const rng = createSeededRng(1234)
    const result = resolve({
      planets: [originA, originB, target],
      fleets: [attackerA, attackerB],
      submissions: [attackMove(PLAYER_A, attackerA, target, 10), attackMove(PLAYER_B, attackerB, target, 20)],
      rng,
    })

    // Assert
    expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([])
    expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([10])
    expect(lastOutcome(result, PLAYER_A).type).toBe("PREVENTED")
    expect(lastOutcome(result, PLAYER_B).type).toBe("RESOLVED")
    expect(rng.getState()).toStrictEqual({ generatorState: 1831567047, spareNormal: null })
  })
})

function createTargetSetup(): CreateTargetSetupResult {
  const origin = planet("speed-two-origin", PLAYER_A, 0)
  const target = planet("speed-two-target", PLAYER_B, 5)
  const attacker = fleet("speed-two-attacker", PLAYER_A, origin, 50)
  const defender = fleet("speed-two-defender", PLAYER_B, target, 20)
  const actionId = SpeedTwoAttackMoveTest.id + "_1"
  const submission = createSubmittedActionStub({
    id: actionId,
    playerId: PLAYER_A,
    actionDefinitionId: SpeedTwoAttackMoveTest.id,
    selectedTargets: { fleet: attacker.id, planet: target.id },
    selectedInputs: { strength: 30 },
  })

  // Act
  const first = resolve({
    planets: [origin, target],
    fleets: [attacker, defender],
    submissions: [submission],
    ruleset: SpeedTwoAttackMoveRuleset,
  })
  const firstJourney = Object.values(first.fleets).find(({ movement }) => movement !== undefined)
  Assert.isDefined(firstJourney)

  // Continue resolving after each persisted JSON reload.
  const second = resolveTurn(
    createTurnStateStub({
      turn: 2,
      players: first.players,
      planets: first.planets,
      fleets: indexBy(
        "id",
        Object.values(first.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue)))),
      ),
    }),
    SpeedTwoAttackMoveRuleset,
    createSeededRng(),
  )
  Assert.isSuccess(second)
  const secondJourney = Object.values(second.value.fleets).find(({ id }) => id === firstJourney.id)
  Assert.isDefined(secondJourney)
  return { target, attacker, defender, first, firstJourney, second, secondJourney }
}

function createThirdSetup(input: CreateThirdSetupInput): CreateThirdSetupResult {
  const third = resolveTurn(
    createTurnStateStub({
      turn: 3,
      players: input.second.value.players,
      planets: input.second.value.planets,
      fleets: indexBy(
        "id",
        Object.values(input.second.value.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue)))),
      ),
    }),
    SpeedTwoAttackMoveRuleset,
    createSeededRng(),
  )
  Assert.isSuccess(third)
  const fourth = resolveTurn(
    createTurnStateStub({
      turn: 4,
      players: third.value.players,
      planets: third.value.planets,
      fleets: indexBy(
        "id",
        Object.values(third.value.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue)))),
      ),
    }),
    SpeedTwoAttackMoveRuleset,
    createSeededRng(),
  )
  Assert.isSuccess(fourth)

  // Assert
  expect(input.firstJourney).toMatchObject({
    strength: 30,
    distanceToEnd: 3,
    movement: { pendingArrivalEffects: [{ definitionOrdinal: 3 }] },
  })
  expect(input.first.fleets[input.attacker.id]?.strength).toBe(20)
  expect(input.first.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(95)
  expect(input.first.players[PLAYER_A]?.resources[ResourceType.FUEL]).toBe(99)
  expect(input.first.resolvedContinuations).toHaveLength(0)
  expect(input.secondJourney.distanceToEnd).toBe(1)
  expect(input.second.value.fleets[input.defender.id]?.strength).toBe(20)
  expect(input.second.value.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(95)
  expect(input.second.value.players[PLAYER_A]?.resources[ResourceType.FUEL]).toBe(99)
  expect(input.second.value.resolvedContinuations).toHaveLength(1)
  const secondContinuation = input.second.value.resolvedContinuations[0]
  Assert.isDefined(secondContinuation)
  const resolvedOutcomes = secondContinuation.actionOutcomes.filter(
    (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> => outcome.type === "RESOLVED",
  )
  expect(resolvedOutcomes.find(({ result }) => result.includes("exchanged"))).toBeUndefined()
  expect(third.value.fleets[input.defender.id]).toBeUndefined()
  expect(third.value.fleets[input.firstJourney.id]).toMatchObject({ strength: 10, originPlanetId: input.target.id })
  expect(third.value.fleets[input.attacker.id]?.strength).toBe(20)
  expect(third.value.resolvedContinuations).toHaveLength(1)
  return { third, fourth }
}

type CreateTargetSetupResult = {
  target: ReturnType<typeof createPlanetStub>
  attacker: ReturnType<typeof createFleetStub>
  defender: ReturnType<typeof createFleetStub>
  first: ResolvedTurnState
  firstJourney: ResolutionFleet
  second: Success<ResolvedTurnState>
  secondJourney: ResolutionFleet
}

type CreateThirdSetupInput = {
  second: Success<ResolvedTurnState>
  firstJourney: ResolutionFleet
  first: ResolvedTurnState
  attacker: ReturnType<typeof createFleetStub>
  secondJourney: ResolutionFleet
  defender: ReturnType<typeof createFleetStub>
  target: ReturnType<typeof createPlanetStub>
}

type CreateThirdSetupResult = { third: Success<ResolvedTurnState>; fourth: Success<ResolvedTurnState> }
