import { Assert } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, PositiveNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { FlexibleAssaultTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { MoveFleetImproved, MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { assertLastOutcome, assertSurvivor } from "./fleet-assault.assertions.test-support.ts"
import {
  PLAYER_A,
  PLAYER_B,
  PLAYER_C,
  resolve,
  planet,
  fleet,
  moveSubmission,
  buildSubmission,
  attackMove,
  stationaryAssault,
  assaultOutcomesFor,
  isAssaultOutcome,
  ownerStrengths,
  outcomeText,
  lastOutcome,
} from "./fleet-assault.test-support.ts"

describe("Fleet Assault", () => {
  it.each([
    { attackerStrength: 30, defenderStrength: 20, expectedAttacker: [10], expectedDefender: [], expectedRemovedCount: 2 },
    { attackerStrength: 20, defenderStrength: 30, expectedAttacker: [], expectedDefender: [10], expectedRemovedCount: 2 },
    { attackerStrength: 20, defenderStrength: 20, expectedAttacker: [], expectedDefender: [], expectedRemovedCount: 3 },
  ])(
    "should exchange the same whole Strength on both sides: $attackerStrength vs $defenderStrength",
    ({ attackerStrength, defenderStrength, expectedAttacker, expectedDefender, expectedRemovedCount }) => {
      // Arrange
      const origin = planet("origin", PLAYER_A, 0)
      const target = planet("target", PLAYER_B, 1)
      const attacker = fleet("attacker", PLAYER_A, origin, attackerStrength)
      const defender = fleet("defender", PLAYER_B, target, defenderStrength)

      // Act
      const result = resolve({
        planets: [origin, target],
        fleets: [attacker, defender],
        submissions: [attackMove(PLAYER_A, attacker, target, attackerStrength)],
      })

      // Assert
      expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual(expectedAttacker)
      expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual(expectedDefender)
      expect(result.removedFleetIds).toHaveLength(expectedRemovedCount)
      expect(result.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(95)
      expect(result.players[PLAYER_A]?.resources[ResourceType.FUEL]).toBe(99)
    },
  )

  it("should allocate combined defender losses proportionally and breaks equal remainders by Fleet Id", () => {
    // Arrange
    const origin = planet("allocation-origin", PLAYER_A, 0)
    const target = planet("allocation-target", PLAYER_B, 1)
    const attacker = fleet("allocation-attacker", PLAYER_A, origin, 20)
    const defenderB = fleet("defender-b", PLAYER_B, target, 10)
    const defenderC = fleet("defender-c", PLAYER_C, target, 20)
    // Act
    const proportional = resolve({
      planets: [origin, target],
      fleets: [attacker, defenderC, defenderB],
      submissions: [attackMove(PLAYER_A, attacker, target, 20)],
    })

    // Assert
    expect(proportional.fleets[attacker.id]).toBeUndefined()
    expect(proportional.fleets[defenderB.id]?.strength).toBe(3)
    expect(proportional.fleets[defenderC.id]?.strength).toBe(7)
    expect(ownerStrengths(proportional.fleets, PLAYER_B)).toStrictEqual([3])
    expect(ownerStrengths(proportional.fleets, PLAYER_C)).toStrictEqual([7])
    const remainingB = proportional.fleets[defenderB.id]
    const remainingC = proportional.fleets[defenderC.id]
    Assert.isDefined(remainingB)
    Assert.isDefined(remainingC)
    expect(remainingB.strength + remainingC.strength).toBe(10)

    const tieAttacker = fleet("tie-attacker", PLAYER_A, origin, 1)
    const tieLow = fleet("tie-a", PLAYER_B, target, 1)
    const tieHigh = fleet("tie-z", PLAYER_C, target, 1)
    const tie = resolve({
      planets: [origin, target],
      fleets: [tieAttacker, tieHigh, tieLow],
      submissions: [attackMove(PLAYER_A, tieAttacker, target, 1)],
    })

    expect(tie.fleets[tieLow.id]).toBeUndefined()
    expect(tie.fleets[tieAttacker.id]).toBeUndefined()
    expect(tie.fleets[tieHigh.id]?.strength).toBe(1)

    const reversedTieAttacker = fleet("tie-attacker", PLAYER_A, origin, 1)
    const reversedTieLow = fleet("tie-a", PLAYER_B, target, 1)
    const reversedTieHigh = fleet("tie-z", PLAYER_C, target, 1)
    const reversedTie = resolve({
      planets: [target, origin],
      fleets: [reversedTieLow, reversedTieAttacker, reversedTieHigh],
      submissions: [attackMove(PLAYER_A, reversedTieAttacker, target, 1)],
    })
    expect(reversedTie.fleets[reversedTieLow.id]).toBeUndefined()
    expect(reversedTie.fleets[reversedTieAttacker.id]).toBeUndefined()
    expect(reversedTie.fleets[reversedTieHigh.id]?.strength).toBe(1)

    const completeAttacker = fleet("complete-attacker", PLAYER_A, origin, 30)
    const completeLow = fleet("complete-b", PLAYER_B, target, 10)
    const completeHigh = fleet("complete-c", PLAYER_C, target, 20)
    const completeExchange = resolve({
      planets: [origin, target],
      fleets: [completeHigh, completeAttacker, completeLow],
      submissions: [attackMove(PLAYER_A, completeAttacker, target, 30)],
    })
    expect(completeExchange.fleets[completeAttacker.id]).toBeUndefined()
    expect(completeExchange.fleets[completeLow.id]).toBeUndefined()
    expect(completeExchange.fleets[completeHigh.id]).toBeUndefined()
  })

  it("should do nothing without a defender and does not treat a transit origin as presence", () => {
    expect.hasAssertions()
    // Arrange
    const noDefenderBattle = planet("presence-battle", PLAYER_A, 0)
    const noDefenderOther = planet("presence-other", PLAYER_B, 4)
    const noDefenderAttacker = fleet("stationary-attacker", PLAYER_A, noDefenderBattle, 30)
    const transitBattle = planet("presence-battle", PLAYER_A, 0)
    const transitOther = planet("presence-other", PLAYER_B, 4)
    const transitAttacker = fleet("stationary-attacker", PLAYER_A, transitBattle, 30)
    const departedSourceId = "transit-source"
    const transitSubmission = createSubmittedActionStub({
      id: MoveFleetImproved.id + "_1",
      playerId: PLAYER_B,
      actionDefinitionId: MoveFleetImproved.id,
      selectedTargets: { fleet: departedSourceId, planet: transitOther.id },
      selectedInputs: { strength: 20 },
    })
    const transitEnemy = createFleetStub({
      id: "transit-enemy",
      ownerPlayerId: PLAYER_B,
      originPlanetId: transitBattle.id,
      destinationPlanetId: transitOther.id,
      distanceToEnd: typedParse(NonNegativeNumberSchema, 3),
      strength: 20,
      movement: {
        speed: typedParse(PositiveNumberSchema, 1),
        departureTurn: typedParse(PositiveIntegerSchema, 1),
        submission: transitSubmission,
        pendingArrivalEffects: [],
      },
    })

    // Act
    const noDefender = resolve({
      planets: [noDefenderBattle, noDefenderOther],
      fleets: [noDefenderAttacker],
      submissions: [stationaryAssault(PLAYER_A, noDefenderAttacker, noDefenderBattle)],
    })
    const transitOnly = resolve({
      turn: 2,
      planets: [transitBattle, transitOther],
      fleets: [transitAttacker, transitEnemy],
      submissions: [stationaryAssault(PLAYER_A, transitAttacker, transitBattle)],
    })

    // Assert

    assertLastOutcome({
      noDefender,
      transitOnly,
      noDefenderAttacker,
      noDefenderBattle,
      transitAttacker,
      transitBattle,
      departedSourceId,
      transitEnemy,
      transitOther,
      transitSubmission,
    })
  })

  it("should let an ordinary Move arrive without fighting", () => {
    // Arrange
    const origin = planet("ordinary-origin", PLAYER_A, 0)
    const target = planet("ordinary-target", PLAYER_B, 1)
    const mover = fleet("ordinary-mover", PLAYER_A, origin, 20)
    const defender = fleet("ordinary-defender", PLAYER_B, target, 20)
    // Act
    const result = resolve({
      planets: [origin, target],
      fleets: [mover, defender],
      submissions: [moveSubmission(PLAYER_A, mover, target, { strength: 20, actionDefinitionId: MoveFleetImproved.id })],
    })

    // Assert
    expect(result.fleets[defender.id]?.strength).toBe(20)
    const ordinaryArrival = Object.values(result.fleets).find(({ ownerPlayerId }) => ownerPlayerId === PLAYER_A)
    Assert.isDefined(ordinaryArrival)
    expect(ordinaryArrival).toMatchObject({ strength: 20, originPlanetId: target.id, movement: undefined })
    expect(result.planets[target.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(result.resolvedActions.flatMap(({ actionOutcomes }) => actionOutcomes.filter(isAssaultOutcome))).toHaveLength(0)
  })

  it("should resolve all arrivals first, then prevents a later Assault after its attacker was destroyed", () => {
    // Arrange
    const originA = planet("tick-origin-a", PLAYER_A, 0)
    const originB = planet("tick-origin-b", PLAYER_B, -0.5)
    const target = planet("tick-target", PLAYER_C, 0.25)
    const attackerA = fleet("tick-attacker-a", PLAYER_A, originA, 30)
    const attackerB = fleet("tick-attacker-b", PLAYER_B, originB, 20)
    // Act
    const result = resolve({
      planets: [originA, originB, target],
      fleets: [attackerA, attackerB],
      submissions: [attackMove(PLAYER_A, attackerA, target, 30), attackMove(PLAYER_B, attackerB, target, 20)],
    })

    // Assert
    expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([10])
    expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([])
    expect(lastOutcome(result, PLAYER_A).type).toBe("RESOLVED")
    expect(lastOutcome(result, PLAYER_B).type).toBe("PREVENTED")
  })

  it("should process every arrival before combat and preserves later survivors", () => {
    // Arrange
    const originA = planet("sequence-origin-a", PLAYER_A, 0.5)
    const originB = planet("sequence-origin-b", PLAYER_B, 0.25)
    const originC = planet("sequence-origin-c", PLAYER_C, 0)
    const target = planet("sequence-target", PLAYER_A, 0.75)
    const attackerA = fleet("sequence-attacker-a", PLAYER_A, originA, 10)
    const attackerB = fleet("sequence-attacker-b", PLAYER_B, originB, 30)
    const attackerC = fleet("sequence-attacker-c", PLAYER_C, originC, 20)
    // Act
    const result = resolve({
      planets: [originA, originB, originC, target],
      fleets: [attackerA, attackerB, attackerC],
      submissions: [
        attackMove(PLAYER_A, attackerA, target, 10),
        attackMove(PLAYER_B, attackerB, target, 30),
        attackMove(PLAYER_C, attackerC, target, 20),
      ],
    })

    // Assert
    expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([])
    expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([8])
    expect(ownerStrengths(result.fleets, PLAYER_C)).toStrictEqual([])
    expect(lastOutcome(result, PLAYER_A).type).toBe("RESOLVED")
    expect(lastOutcome(result, PLAYER_B).type).toBe("RESOLVED")
    expect(lastOutcome(result, PLAYER_C).type).toBe("PREVENTED")
    expect(outcomeText(result, PLAYER_A)).toContain("exchanged 10 Strength with 50 enemy Strength")
    expect(outcomeText(result, PLAYER_B)).toContain("exchanged 16 Strength with 16 enemy Strength")
  })

  it("should leave defenders at 24 and 16 after the first 10-strength Assault", () => {
    // Arrange
    const origin = planet("first-exchange-origin", PLAYER_A, 0.5)
    const target = planet("first-exchange-target", PLAYER_B, 0.75)
    const attacker = fleet("first-exchange-attacker", PLAYER_A, origin, 10)
    const defenderB = fleet("first-exchange-defender-b", PLAYER_B, target, 30)
    const defenderC = fleet("first-exchange-defender-c", PLAYER_C, target, 20)

    // Act
    const result = resolve({
      planets: [origin, target],
      fleets: [attacker, defenderB, defenderC],
      submissions: [attackMove(PLAYER_A, attacker, target, 10)],
    })

    // Assert
    expect(result.fleets[attacker.id]).toBeUndefined()
    expect(result.fleets[defenderB.id]?.strength).toBe(24)
    expect(result.fleets[defenderC.id]?.strength).toBe(16)
    expect(outcomeText(result, PLAYER_A)).toContain("exchanged 10 Strength with 50 enemy Strength")
  })

  it("should finish movement and Builds before combat while excluding an outgoing transit Fleet", () => {
    // Arrange
    const home = planet("phase-home", PLAYER_A, 1)
    const departure = planet("phase-departure", PLAYER_A, 0)
    const opponentOrigin = planet("phase-opponent-origin", PLAYER_B, 0)
    const outboundDestination = planet("phase-outbound-destination", PLAYER_A, 3)
    const defender = fleet("phase-defender", PLAYER_A, home, 25)
    const friendlyArrival = fleet("phase-friendly-arrival", PLAYER_A, departure, 10)
    const opponentArrival = fleet("phase-opponent-arrival", PLAYER_B, opponentOrigin, 20)
    // Act
    const result = resolve({
      planets: [home, departure, opponentOrigin, outboundDestination],
      fleets: [defender, friendlyArrival, opponentArrival],
      submissions: [
        moveSubmission(PLAYER_A, defender, outboundDestination, { strength: 20, actionDefinitionId: MoveFleetStandard.id }),
        moveSubmission(PLAYER_A, friendlyArrival, home, { strength: 10, actionDefinitionId: MoveFleetImproved.id }),
        buildSubmission(PLAYER_A, home),
        attackMove(PLAYER_B, opponentArrival, home, 20),
      ],
    })

    // Assert
    expect(result.fleets[defender.id]?.strength).toBe(5)
    expect(result.fleets[defender.id]?.name).toBe(defender.name)
    expect(result.fleets[opponentArrival.id]).toBeUndefined()
    expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([])
    const outbound = Object.values(result.fleets).find(({ movement }) => movement?.submission.id === MoveFleetStandard.id + "_1")
    expect(outbound?.strength).toBe(20)
    expect(outbound?.originPlanetId).toBe(home.id)
    expect(outbound?.destinationPlanetId).toBe(outboundDestination.id)
  })

  it("should apply the exact defender30, outgoing20, incoming5, Build10 vector before combat", () => {
    // Arrange
    const home = planet("i2-07-home", PLAYER_A, 1)
    const departure = planet("i2-07-departure", PLAYER_A, 0)
    const opponentOrigin = planet("i2-07-opponent", PLAYER_B, 0)
    const outboundDestination = planet("i2-07-outbound", PLAYER_A, 3)
    const defender = fleet("i2-07-defender", PLAYER_A, home, 30)
    const friendlyArrival = fleet("i2-07-friendly-arrival", PLAYER_A, departure, 5)
    const opponentArrival = fleet("i2-07-opponent-arrival", PLAYER_B, opponentOrigin, 20)

    // Act
    const result = resolve({
      planets: [home, departure, opponentOrigin, outboundDestination],
      fleets: [defender, friendlyArrival, opponentArrival],
      submissions: [
        moveSubmission(PLAYER_A, defender, outboundDestination, { strength: 20, actionDefinitionId: MoveFleetStandard.id }),
        moveSubmission(PLAYER_A, friendlyArrival, home, { strength: 5, actionDefinitionId: MoveFleetImproved.id }),
        buildSubmission(PLAYER_A, home),
        attackMove(PLAYER_B, opponentArrival, home, 20),
      ],
    })

    // Assert
    expect(result.fleets[defender.id]).toMatchObject({ strength: 5, name: defender.name, originPlanetId: home.id })
    expect(result.fleets[friendlyArrival.id]).toBeUndefined()
    expect(result.fleets[opponentArrival.id]).toBeUndefined()
    const outbound = Object.values(result.fleets).find(({ movement }) => movement?.submission.id === MoveFleetStandard.id + "_1")
    expect(outbound).toMatchObject({ strength: 20, originPlanetId: home.id, destinationPlanetId: outboundDestination.id })
    expect(lastOutcome(result, PLAYER_B).type).toBe("RESOLVED")
  })

  it("should leave an incoming Assault unchanged when its full outgoing source is in transit", () => {
    // Arrange
    const home = planet("i2-07-empty-home", PLAYER_A, 1)
    const opponentOrigin = planet("i2-07-empty-opponent", PLAYER_B, 0)
    const outboundDestination = planet("i2-07-empty-outbound", PLAYER_A, 3)
    const defender = fleet("i2-07-empty-defender", PLAYER_A, home, 30)
    const opponentArrival = fleet("i2-07-empty-arrival", PLAYER_B, opponentOrigin, 20)

    // Act
    const result = resolve({
      planets: [home, opponentOrigin, outboundDestination],
      fleets: [defender, opponentArrival],
      submissions: [
        moveSubmission(PLAYER_A, defender, outboundDestination, { strength: 30, actionDefinitionId: MoveFleetImproved.id }),
        attackMove(PLAYER_B, opponentArrival, home, 20),
      ],
    })

    // Assert
    expect(result.fleets[defender.id]).toBeUndefined()
    expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([20])
    const outbound = Object.values(result.fleets).find(({ movement }) => movement?.submission.id === MoveFleetImproved.id + "_1")
    expect(outbound).toMatchObject({ strength: 30, originPlanetId: home.id, destinationPlanetId: outboundDestination.id })
    expect(lastOutcome(result, PLAYER_B)).toMatchObject({
      type: "RESOLVED",
      result: 'Fleet "i2-07-empty-arrival-name" found no enemy Fleets at Planet "planet-i2-07-em"',
    })
  })

  it("should merge friendly arrivals and Build Strength before an Assault while preserving survivor identity", () => {
    // Arrange
    const home = planet("merge-home", PLAYER_A, 1)
    const attackOrigin = planet("merge-attack-origin", PLAYER_A, 0)
    const moveOrigin = planet("merge-move-origin", PLAYER_A, 0.5)
    const base = fleet("merge-base", PLAYER_A, home, 7)
    const attacker = fleet("merge-attacker", PLAYER_A, attackOrigin, 20)
    const mover = fleet("merge-mover", PLAYER_A, moveOrigin, 5)
    const enemy = fleet("merge-enemy", PLAYER_B, home, 20)
    // Act
    const result = resolve({
      planets: [home, attackOrigin, moveOrigin],
      fleets: [base, attacker, mover, enemy],
      submissions: [
        attackMove(PLAYER_A, attacker, home, 20),
        moveSubmission(PLAYER_A, mover, home, { strength: 5, actionDefinitionId: MoveFleetImproved.id }),
        buildSubmission(PLAYER_A, home),
      ],
    })

    // Assert
    expect(result.fleets[base.id]).toMatchObject({ strength: 22, name: base.name, originPlanetId: home.id })
    expect(result.fleets[enemy.id]).toBeUndefined()
    expect(Object.values(result.fleets).filter((candidate) => candidate.ownerPlayerId === PLAYER_A)).toHaveLength(1)
  })

  it("should include an enemy same-turn Build in the defending force before the Assault", () => {
    // Arrange
    const origin = planet("enemy-build-origin", PLAYER_A, 0)
    const target = planet("enemy-build-target", PLAYER_B, 1)
    const attacker = fleet("enemy-build-attacker", PLAYER_A, origin, 30)
    const defender = fleet("enemy-build-defender", PLAYER_B, target, 20)

    // Act
    const result = resolve({
      planets: [origin, target],
      fleets: [attacker, defender],
      submissions: [attackMove(PLAYER_A, attacker, target, 30), buildSubmission(PLAYER_B, target)],
    })

    // Assert
    expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([])
    expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([])
    expect(outcomeText(result, PLAYER_A)).toContain("exchanged 30 Strength with 30 enemy Strength")
  })

  it("should keep two merged initiating Assaults as distinct ordered outcomes", () => {
    // Arrange
    const origin = planet("provenance-origin", PLAYER_A, 0)
    const target = planet("provenance-target", PLAYER_B, 1)
    const slowerAttacker = fleet("provenance-slower", PLAYER_A, origin, 20)
    const fasterAttacker = fleet("provenance-faster", PLAYER_A, origin, 15)
    const defender = fleet("provenance-defender", PLAYER_B, target, 10)
    const slowerSubmission = attackMove(PLAYER_A, slowerAttacker, target, 20)
    const fasterSubmission = createSubmittedActionStub({
      id: FlexibleAssaultTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: FlexibleAssaultTest.id,
      selectedTargets: { source: fasterAttacker.id, destination: target.id },
      selectedInputs: { force: 15 },
    })

    // Act
    const result = resolve({
      planets: [origin, target],
      fleets: [slowerAttacker, fasterAttacker, defender],
      submissions: [slowerSubmission, fasterSubmission],
    })

    // Assert
    expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([25])
    expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([])
    expect(result.fleets[defender.id]).toBeUndefined()
    expect(result.removedFleetIds).toHaveLength(4)
    expect(result.removedFleetIds).toStrictEqual(expect.arrayContaining([slowerAttacker.id, fasterAttacker.id, defender.id]))
    const survivor = Object.values(result.fleets).find(({ ownerPlayerId }) => ownerPlayerId === PLAYER_A)
    Assert.isDefined(survivor)
    expect(survivor).toMatchObject({
      ownerPlayerId: PLAYER_A,
      name: fasterAttacker.name,
      strength: 25,
      originPlanetId: target.id,
    })
    expect(survivor.movement).toBeUndefined()
    const fasterAssaults = assaultOutcomesFor(result, PLAYER_A, fasterSubmission.id)
    const slowerAssaults = assaultOutcomesFor(result, PLAYER_A, slowerSubmission.id)
    expect(fasterAssaults).toHaveLength(1)
    expect(fasterAssaults[0]).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("exchanged 10 Strength with 10 enemy Strength"),
    })
    expect(slowerAssaults).toHaveLength(1)
    expect(slowerAssaults[0]).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("found no enemy Fleets"),
    })
  })

  it("should resolve the chronological 20-first then 15 Assault after their merge, independent of input order", () => {
    // Arrange
    const createFixture = (): {
      origin: Planet
      target: Planet
      earlierTwenty: Fleet
      laterFifteen: Fleet
      defender: Fleet
      earlierSubmission: ReturnType<typeof createSubmittedActionStub>
      laterSubmission: ReturnType<typeof createSubmittedActionStub>
    } => {
      const origin = planet("provenance-complement-origin", PLAYER_A, 0)
      const target = planet("provenance-complement-target", PLAYER_B, 1)
      const earlierTwenty = fleet("provenance-complement-20", PLAYER_A, origin, 20)
      const laterFifteen = fleet("provenance-complement-15", PLAYER_A, origin, 15)
      const defender = fleet("provenance-complement-defender", PLAYER_B, target, 10)
      const earlierSubmission = createSubmittedActionStub({
        id: FlexibleAssaultTest.id + "_1",
        playerId: PLAYER_A,
        actionDefinitionId: FlexibleAssaultTest.id,
        selectedTargets: { source: earlierTwenty.id, destination: target.id },
        selectedInputs: { force: 20 },
      })
      const laterSubmission = attackMove(PLAYER_A, laterFifteen, target, 15)
      return { origin, target, earlierTwenty, laterFifteen, defender, earlierSubmission, laterSubmission }
    }
    const fixture = createFixture()
    const permutedFixture = createFixture()

    // Act
    const result = resolve({
      planets: [fixture.origin, fixture.target],
      fleets: [fixture.laterFifteen, fixture.earlierTwenty, fixture.defender],
      submissions: [fixture.laterSubmission, fixture.earlierSubmission],
    })
    const permuted = resolve({
      planets: [permutedFixture.target, permutedFixture.origin],
      fleets: [permutedFixture.defender, permutedFixture.earlierTwenty, permutedFixture.laterFifteen],
      submissions: [permutedFixture.earlierSubmission, permutedFixture.laterSubmission],
    })

    // Assert
    expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([25])
    expect(ownerStrengths(result.fleets, PLAYER_B)).toStrictEqual([])
    expect(result.fleets[fixture.defender.id]).toBeUndefined()
    expect(result.removedFleetIds).toHaveLength(4)
    expect(result.removedFleetIds).toStrictEqual(
      expect.arrayContaining([fixture.earlierTwenty.id, fixture.laterFifteen.id, fixture.defender.id]),
    )
    const survivor = Object.values(result.fleets).find(({ ownerPlayerId }) => ownerPlayerId === PLAYER_A)
    const permutedSurvivor = Object.values(permuted.fleets).find(({ ownerPlayerId }) => ownerPlayerId === PLAYER_A)
    Assert.isDefined(survivor)
    Assert.isDefined(permutedSurvivor)

    assertSurvivor({ survivor, fixture, permutedSurvivor, permuted, permutedFixture, result })

    const earlierAssaults = assaultOutcomesFor(result, PLAYER_A, fixture.earlierSubmission.id)
    const laterAssaults = assaultOutcomesFor(result, PLAYER_A, fixture.laterSubmission.id)
    expect(earlierAssaults).toHaveLength(1)
    expect(earlierAssaults[0]).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("exchanged 10 Strength with 10 enemy Strength"),
    })
    expect(laterAssaults).toHaveLength(1)
    expect(laterAssaults[0]).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("found no enemy Fleets"),
    })
    expect(assaultOutcomesFor(permuted, PLAYER_A, permutedFixture.earlierSubmission.id)).toStrictEqual(earlierAssaults)
    expect(assaultOutcomesFor(permuted, PLAYER_A, permutedFixture.laterSubmission.id)).toStrictEqual(laterAssaults)
  })

  it("should produce one Assault outcome when an ordinary arrival merges before an Attack Move", () => {
    // Arrange
    const ordinaryOrigin = planet("ordinary-first-origin", PLAYER_A, 0.25)
    const assaultOrigin = planet("ordinary-first-assault-origin", PLAYER_A, 0)
    const target = planet("ordinary-first-target", PLAYER_B, 1)
    const ordinaryArrival = fleet("ordinary-first-arrival", PLAYER_A, ordinaryOrigin, 20)
    const assaultArrival = fleet("ordinary-first-assault", PLAYER_A, assaultOrigin, 15)
    const defender = fleet("ordinary-first-defender", PLAYER_B, target, 10)
    const ordinarySubmission = moveSubmission(PLAYER_A, ordinaryArrival, target, { strength: 20, actionDefinitionId: MoveFleetImproved.id })
    const assaultSubmission = attackMove(PLAYER_A, assaultArrival, target, 15)

    // Act
    const result = resolve({
      planets: [ordinaryOrigin, assaultOrigin, target],
      fleets: [ordinaryArrival, assaultArrival, defender],
      submissions: [ordinarySubmission, assaultSubmission],
    })

    // Assert
    expect(ownerStrengths(result.fleets, PLAYER_A)).toStrictEqual([25])
    expect(result.fleets[defender.id]).toBeUndefined()
    expect(outcomeText(result, PLAYER_A, assaultSubmission.id)).toContain("exchanged 10 Strength with 10 enemy Strength")
    const assaultOutcomes = result.resolvedActions.flatMap(({ actionOutcomes }) => actionOutcomes).filter(isAssaultOutcome)
    expect(assaultOutcomes).toHaveLength(1)
  })
})
