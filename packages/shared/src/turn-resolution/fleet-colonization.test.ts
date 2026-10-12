import { Assert, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetSchema, type Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { isPlanetUnclaimed } from "#shared/domain/world/planets/isPlanetUnclaimed.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { ColonizeHereTest, ColonizePlanetTest, SeedOutpostTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { resolveColonizationPhase } from "#shared/turn-resolution/phases/implementations/resolveColonizationPhase.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { TurnContext, PendingArrivalColonizationIntent } from "#shared/turn-resolution/TurnContext.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

const PLAYER_A = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
const PLAYER_B = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000002")
const PLAYER_C = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000003")

describe("Fleet Colonization", () => {
  it("should persist a 35-Strength arrival through JSON reloads, consume20 once, and preserve the source remainder", () => {
    const origin = planet("arrival-origin", PLAYER_A, 0)
    const target = planet("arrival-neutral", null, 2.5)
    const source = fleet("arrival-source", PLAYER_A, origin, 50)
    const action = submit({
      id: ColonizePlanetTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizePlanetTest.id,
      source,
      target,
      strength: 35,
    })
    const rng = createSeededRng(987)

    const departure = resolve({ planets: [origin, target], fleets: [source], submissions: [action], rng })
    const journey = Object.values(departure.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(journey)
    expect(departure.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(departure.fleets[source.id]?.strength).toBe(15)
    expect(journey).toMatchObject({ strength: 35, distanceToEnd: 1.5, movement: { departureTurn: 1 } })
    expect(departure.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(25)

    const continuation = resolveContinuation(departure, 2, rng)
    const reloadedJourney = continuation.fleets[journey.id]
    Assert.isDefined(reloadedJourney)
    expect(reloadedJourney.distanceToEnd).toBe(0.5)
    expect(continuation.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(25)
    expect(continuation.resolvedActions).toStrictEqual([])

    const arrival = resolveContinuation(continuation, 3, rng)
    expect(arrival.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(arrival.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: PLAYER_A }])
    expect(arrival.fleets[source.id]?.strength).toBe(15)
    expect(arrival.fleets[journey.id]).toMatchObject({
      id: journey.id,
      originPlanetId: target.id,
      strength: 15,
      movement: undefined,
      destinationPlanetId: undefined,
      distanceToEnd: undefined,
    })
    expect(arrival.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(25)
    expect(arrival.fleets[journey.id]?.arrivedAtTick).toBe(10)
    expect(arrival.resolvedContinuations[0]?.actionOutcomes.at(-1)).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("colonized Planet"),
    })
    expect(arrival.removedFleetIds).not.toContain(journey.id)
    const emptyTurn = resolveContinuation(arrival, 4)
    expect(emptyTurn.fleets[journey.id]?.strength).toBe(15)
    expect(emptyTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
  })

  it("should resolve renamed Seed Outpost at its exact threshold and range edge with speed2 and one-time costs", () => {
    const ruleset = createRuleset(
      [SeedOutpostTest],
      [
        { id: "SEED_OUTPOST_FULL_1", actionDefinitionId: SeedOutpostTest.id },
        { id: "SEED_OUTPOST_EDGE_1", actionDefinitionId: SeedOutpostTest.id },
      ],
    )
    const origin = planet("seed-outpost-origin", PLAYER_A, 0)
    const target = planet("seed-outpost-site", null, 2.5)
    const source = fleet("seed-outpost-force", PLAYER_A, origin, 50)
    const action = createSubmittedActionStub({
      id: "SEED_OUTPOST_FULL_1",
      playerId: PLAYER_A,
      actionDefinitionId: SeedOutpostTest.id,
      selectedTargets: { force: source.id, site: target.id },
      selectedInputs: { quota: 45 },
    })
    const departure = resolve({ planets: [origin, target], fleets: [source], submissions: [action], ruleset })
    const journey = Object.values(departure.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(journey)

    expect(departure.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(departure.fleets[source.id]?.strength).toBe(5)
    expect(journey).toMatchObject({
      strength: 45,
      destinationPlanetId: target.id,
      distanceToEnd: 0.5,
      movement: {
        speed: 2,
        departureTurn: 1,
        submission: {
          actionDefinitionId: SeedOutpostTest.id,
          selectedTargets: { force: source.id, site: target.id },
          selectedInputs: { quota: 45 },
        },
      },
    })
    expect(journey.movement?.pendingArrivalEffects).toContainEqual(
      expect.objectContaining({
        effectDefinition: {
          type: "FLEET_COLONIZE",
          targets: {
            fleet: { actionTargetTag: "force", targetType: "FLEET" },
            planet: { actionTargetTag: "site", targetType: "PLANET" },
          },
          parameters: { strengthRequirement: 30 },
        },
      }),
    )
    expect(departure.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 43,
      [ResourceType.FUEL]: 98,
    })

    const arrival = resolveContinuation(departure, 2, createSeededRng(1234), ruleset)
    expect(arrival.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(arrival.fleets[journey.id]?.arrivedAtTick).toBe(5)
    expect(arrival.fleets[journey.id]).toMatchObject({
      originPlanetId: target.id,
      strength: 15,
      movement: undefined,
      destinationPlanetId: undefined,
      distanceToEnd: undefined,
    })
    expect(arrival.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 43,
      [ResourceType.FUEL]: 98,
    })
    expect(arrival.resolvedContinuations[0]?.actionOutcomes.at(-1)).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("colonized Planet"),
    })

    const emptyTurn = resolveContinuation(arrival, 3, createSeededRng(1234), ruleset)
    expect(emptyTurn.fleets[journey.id]?.strength).toBe(15)
    expect(emptyTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(emptyTurn.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 43,
      [ResourceType.FUEL]: 98,
    })

    const edgeOrigin = planet("seed-outpost-edge-origin", PLAYER_A, 0)
    const edgeSite = planet("seed-outpost-range-edge", null, 3)
    const edgeSource = fleet("seed-outpost-edge-force", PLAYER_A, edgeOrigin, 30)
    const edgeAction = createSubmittedActionStub({
      id: "SEED_OUTPOST_EDGE_1",
      playerId: PLAYER_A,
      actionDefinitionId: SeedOutpostTest.id,
      selectedTargets: { force: edgeSource.id, site: edgeSite.id },
      selectedInputs: { quota: 30 },
    })
    const edgeDeparture = resolve({
      planets: [edgeOrigin, edgeSite],
      fleets: [edgeSource],
      submissions: [edgeAction],
      ruleset,
    })
    const edgeJourney = Object.values(edgeDeparture.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(edgeJourney)
    expect(edgeDeparture.planets[edgeSite.id]?.ownerPlayerId).toBeNull()
    expect(edgeDeparture.fleets[edgeSource.id]).toBeUndefined()
    expect(edgeJourney).toMatchObject({ strength: 30, distanceToEnd: 1, movement: { speed: 2, departureTurn: 1 } })
    expect(edgeDeparture.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 43,
      [ResourceType.FUEL]: 98,
    })

    const edgeArrival = resolveContinuation(edgeDeparture, 2, createSeededRng(1234), ruleset)
    expect(edgeArrival.planets[edgeSite.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(edgeArrival.fleets[edgeJourney.id]).toBeUndefined()
    expect(edgeArrival.removedFleetIds).toContain(edgeJourney.id)
    expect(edgeArrival.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 43,
      [ResourceType.FUEL]: 98,
    })
  })

  it("should delete an exact20 arrival, report its removed id, and publish only the changed owner", () => {
    const origin = planet("exact-origin", PLAYER_A, 0)
    const target = planet("exact-target", null, 2)
    const source = fleet("exact-source", PLAYER_A, origin, 20)
    const action = submit({
      id: ColonizePlanetTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizePlanetTest.id,
      source,
      target,
      strength: 20,
    })

    const resolved = resolve({ planets: [origin, target], fleets: [source], submissions: [action] })
    const journeyId = Object.values(resolved.fleets).find(({ movement }) => movement !== undefined)?.id
    Assert.isDefined(journeyId)
    const arrival = resolveContinuation(resolved, 2)

    expect(arrival.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(arrival.fleets[journeyId]).toBeUndefined()
    expect(arrival.removedFleetIds).toContain(journeyId)
    expect(arrival.fleets[source.id]).toBeUndefined()
    expect(arrival.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: PLAYER_A }])
    expect(arrival.resolvedContinuations[0]?.actionOutcomes.at(-1)?.type).toBe("RESOLVED")
    const emptyTurn = resolveContinuation(arrival, 3)
    expect(emptyTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(emptyTurn.fleets[journeyId]).toBeUndefined()
    expect(emptyTurn.planetOwnershipChanges).toStrictEqual([])
  })

  it("should resolve earliest valid Colonization first and make reversed collections equivalent", () => {
    const scenario = createArrivalRace({ firstDistance: 0.2, secondDistance: 0.4 })
    const forwardRng = createSeededRng(0)
    const forwardRngBefore = forwardRng.getState()
    const forward = resolve({ ...scenario, rng: forwardRng })
    const reversedRng = createSeededRng(0)
    const reversedRngBefore = reversedRng.getState()
    const reversed = resolve({
      ...scenario,
      planets: scenario.planets.toReversed(),
      fleets: scenario.fleets.toReversed(),
      submissions: scenario.submissions.toReversed(),
      rng: reversedRng,
    })

    expect(forward.planets[scenario.target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(fleetAtPlanetForOwner(forward, scenario.target.id, PLAYER_A)).toMatchObject({ arrivedAtTick: 4 })
    expect(fleetAtPlanetForOwner(forward, scenario.target.id, PLAYER_B)).toMatchObject({ arrivedAtTick: 8 })
    expect(forward.fleets[scenario.firstSource.id]).toBeUndefined()
    expect(forward.fleets[scenario.secondSource.id]).toBeUndefined()
    expect(
      Object.values(forward.fleets)
        .filter(({ ownerPlayerId }) => ownerPlayerId === PLAYER_A)
        .map(({ strength }) => strength),
    ).toStrictEqual([15])
    expect(
      Object.values(forward.fleets)
        .filter(({ ownerPlayerId }) => ownerPlayerId === PLAYER_B)
        .map(({ strength }) => strength),
    ).toStrictEqual([35])
    expect(outcomeFor(forward, PLAYER_A, scenario.firstAction.id).type).toBe("RESOLVED")
    expect(outcomeFor(forward, PLAYER_B, scenario.secondAction.id)).toMatchObject({
      type: "PREVENTED",
      reason: "Planet is already claimed",
    })
    expect(forwardRng.getState()).toStrictEqual(forwardRngBefore)
    expect(reversedRng.getState()).toStrictEqual(reversedRngBefore)
    expect(outcomeFor(reversed, PLAYER_A, scenario.firstAction.id)).toStrictEqual(outcomeFor(forward, PLAYER_A, scenario.firstAction.id))
    expect(outcomeFor(reversed, PLAYER_B, scenario.secondAction.id)).toStrictEqual(outcomeFor(forward, PLAYER_B, scenario.secondAction.id))
    expect(reversed.planets).toStrictEqual(forward.planets)
    expect(reversed.fleets).toStrictEqual(forward.fleets)
    expect(reversed.players).toStrictEqual(forward.players)
    expect(reversed.planetOwnershipChanges).toStrictEqual(forward.planetOwnershipChanges)
    expect(reversed.removedFleetIds).toStrictEqual(forward.removedFleetIds)
  })

  it.each([
    { seed: 0, owner: PLAYER_B, aStrength: 35, bStrength: 15, generatorState: 1831565813 },
    { seed: 1, owner: PLAYER_A, aStrength: 15, bStrength: 35, generatorState: 1831565814 },
  ])("should shuffle only eligible same-tick contenders with seed $seed", ({ seed, owner, aStrength, bStrength, generatorState }) => {
    const scenario = createArrivalRace({ firstDistance: 0.2, secondDistance: 0.2 })
    const rng = createSeededRng(seed)
    const resolved = resolve({ ...scenario, rng })

    expect(resolved.planets[scenario.target.id]?.ownerPlayerId).toBe(owner)
    expect(fleetAtPlanetForOwner(resolved, scenario.target.id, PLAYER_A)).toMatchObject({ arrivedAtTick: 4 })
    expect(fleetAtPlanetForOwner(resolved, scenario.target.id, PLAYER_B)).toMatchObject({ arrivedAtTick: 4 })
    expect(fleetStrengthForOwner(resolved, PLAYER_A)).toBe(aStrength)
    expect(fleetStrengthForOwner(resolved, PLAYER_B)).toBe(bStrength)
    expect(rng.getState()).toStrictEqual({ generatorState, spareNormal: null })

    const reversedRng = createSeededRng(seed)
    const replayed = resolve({
      ...scenario,
      planets: scenario.planets.toReversed(),
      fleets: scenario.fleets.toReversed(),
      submissions: scenario.submissions.toReversed(),
      rng: reversedRng,
    })
    expect(replayed.planets[scenario.target.id]?.ownerPlayerId).toBe(owner)
    expect(replayed.planets).toStrictEqual(resolved.planets)
    expect(replayed.fleets).toStrictEqual(resolved.fleets)
    expect(replayed.players).toStrictEqual(resolved.players)
    expect(replayed.planetOwnershipChanges).toStrictEqual(resolved.planetOwnershipChanges)
    expect(replayed.removedFleetIds).toStrictEqual(resolved.removedFleetIds)
    expect(outcomeFor(replayed, PLAYER_A, scenario.firstAction.id)).toStrictEqual(outcomeFor(resolved, PLAYER_A, scenario.firstAction.id))
    expect(outcomeFor(replayed, PLAYER_B, scenario.secondAction.id)).toStrictEqual(outcomeFor(resolved, PLAYER_B, scenario.secondAction.id))
    expect(reversedRng.getState()).toStrictEqual(rng.getState())
  })

  it("should treat only a null Planet owner as unclaimed", () => {
    expect(isPlanetUnclaimed(null)).toBe(true)
    expect(isPlanetUnclaimed(PLAYER_A)).toBe(false)
  })

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
    expect(resolved.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(ordinaryMove.effects.map(({ type }) => type)).toStrictEqual(["FLEET_MOVE"])
    expect(outcomesFor(resolved, PLAYER_A, action.id).every(({ type }) => type === "RESOLVED")).toBe(true)
  })

  it("should preserve COLONY7 after success, prevention, and the following empty Turns", () => {
    // Arrange the successful colonization case.
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
    expect(success.fleets[successfulFleet.id]?.strength).toBe(15)
    expect(success.players[PLAYER_A]?.resources[ResourceType.COLONY]).toBe(7)
    // Act: resolve the following empty Turn.
    const successEmptyTurn = resolveContinuation(success, 2)
    // Assert the owner, remaining strength, and stockpile persist.
    expect(successEmptyTurn.planets[successPlanet.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(successEmptyTurn.fleets[successfulFleet.id]?.strength).toBe(15)
    expect(successEmptyTurn.players[PLAYER_A]?.resources[ResourceType.COLONY]).toBe(7)

    // Arrange the prevented colonization case.
    const assaultColonize = createColonizeMoveAction({ id: "TEST_COLONY7_ASSAULT", speed: 1, withAssault: true })
    const ruleset = createRuleset([assaultColonize], [{ id: "COLONY_STOCKPILE_ASSAULT_1", actionDefinitionId: assaultColonize.id }])
    const origin = planet("colony-stockpile-prevention-origin", PLAYER_A, 0)
    const target = planet("colony-stockpile-prevention-target", null, 1)
    const attacker = fleet("colony-stockpile-prevention-attacker", PLAYER_A, origin, 35)
    const defender = fleet("colony-stockpile-prevention-defender", PLAYER_B, target, 16)
    const attack = submit({
      id: "COLONY_STOCKPILE_ASSAULT_1",
      playerId: PLAYER_A,
      actionDefinitionId: assaultColonize.id,
      source: attacker,
      target,
      strength: 35,
    })
    // Act
    const prevention = resolve({
      planets: [origin, target],
      fleets: [attacker, defender],
      submissions: [attack],
      ruleset,
      colonyStockpile: 7,
    })
    // Assert combat leaves 19, does not claim, and preserves COLONY7.
    expect(prevention.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(fleetStrengthForOwner(prevention, PLAYER_A)).toBe(19)
    expect(prevention.fleets[defender.id]).toBeUndefined()
    expect(outcomesFor(prevention, PLAYER_A, attack.id)).toContainEqual(
      expect.objectContaining({ type: "PREVENTED", reason: expect.stringContaining("below the 20 required") }),
    )
    expect(prevention.players[PLAYER_A]?.resources[ResourceType.COLONY]).toBe(7)
    // Act: resolve the following empty Turn.
    const preventionEmptyTurn = resolveContinuation(prevention, 2, createSeededRng(1234), ruleset)
    // Assert the prevented owner, surviving force, and stockpile persist.
    expect(preventionEmptyTurn.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(fleetStrengthForOwner(preventionEmptyTurn, PLAYER_A)).toBe(19)
    expect(preventionEmptyTurn.players[PLAYER_A]?.resources[ResourceType.COLONY]).toBe(7)
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
    expect(colonization.fleets[defender.id]?.strength).toBe(10)
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
    expect(resolved35.fleets[fleet35.id]?.strength).toBe(15)
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
    expect(uncontested.resolved.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 22,
      [ResourceType.FUEL]: 99,
    })

    const weakened = runStandaloneColonizeWithMove(true)
    const weakenedJourney = journeyTo(weakened.resolved, weakened.destination.id)
    Assert.isDefined(weakenedJourney)
    Assert.isDefined(weakened.attacker)
    expect(weakened.resolved.planets[weakened.origin.id]?.ownerPlayerId).toBeNull()
    expect(weakened.resolved.fleets[weakened.source.id]?.strength).toBe(19)
    expect(weakened.resolved.fleets[weakened.attacker.id]).toBeUndefined()
    expect(weakenedJourney.strength).toBe(15)
    expect(outcomeFor(weakened.resolved, PLAYER_A, weakened.colonize.id).type).toBe("PREVENTED")
    expect(weakened.resolved.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 22,
      [ResourceType.FUEL]: 99,
    })
  })

  it("should reject an earlier invalid current force and still let a later eligible arrival claim", () => {
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
    const result = resolveColonizeOnly({ planets: [target, originA, originB], fleets: [fleetA, fleetB], intents, rng })

    expect(result.context.turnState.planets[target.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(result.context.turnState.fleets[fleetA.id]?.strength).toBe(19)
    expect(result.context.turnState.fleets[fleetB.id]?.strength).toBe(15)
    expect(intents[0]?.actionOutcomes.at(-1)).toMatchObject({
      type: "PREVENTED",
      reason: "Fleet has 19 Strength, below the 20 required to colonize",
    })
    expect(intents[1]?.actionOutcomes.at(-1)).toMatchObject({ type: "RESOLVED" })
    expect(rng.getState()).toStrictEqual(before)

    const deadTarget = planet("phase-dead-target", null, 0)
    const deadFleetB = fleet("phase-dead-valid-b", PLAYER_B, deadTarget, 35)
    const deadIntents = [
      intent({ fleet: fleetA, action: actionA, target: deadTarget, tick: 4, colonizeDefinition }),
      intent({ fleet: deadFleetB, action: actionB, target: deadTarget, tick: 8, colonizeDefinition }),
    ]
    const deadRng = createSeededRng(0)
    const deadRngBefore = deadRng.getState()
    const dead = resolveColonizeOnly({ planets: [deadTarget], fleets: [deadFleetB], intents: deadIntents, rng: deadRng })
    expect(dead.context.turnState.fleets[fleetA.id]).toBeUndefined()
    expect(dead.context.turnState.fleets[deadFleetB.id]?.strength).toBe(15)
    expect(deadIntents[0]?.actionOutcomes.at(-1)).toMatchObject({
      type: "PREVENTED",
      reason: expect.stringContaining("destroyed before colonization"),
    })
    expect(deadIntents[1]?.actionOutcomes.at(-1)).toMatchObject({ type: "RESOLVED" })
    expect(deadRng.getState()).toStrictEqual(deadRngBefore)
    expect(dead.context.turnState.planets[deadTarget.id]?.ownerPlayerId).toBe(PLAYER_B)
  })

  it("should remove invalid same-tick candidates before arbitration and preserve eligible-only RNG draws", () => {
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
    const resolved = resolveColonizeOnly({ planets: [target], fleets: [fleetA, fleetB, fleetC], intents, rng })

    expect(resolved.context.turnState.planets[target.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(resolved.context.turnState.fleets[fleetA.id]?.strength).toBe(35)
    expect(resolved.context.turnState.fleets[fleetB.id]?.strength).toBe(15)
    expect(resolved.context.turnState.fleets[fleetC.id]?.strength).toBe(19)
    expect(intents[0]?.actionOutcomes.at(-1)).toMatchObject({ type: "PREVENTED" })
    expect(intents[1]?.actionOutcomes.at(-1)).toMatchObject({ type: "RESOLVED" })
    expect(intents[2]?.actionOutcomes.at(-1)).toMatchObject({
      type: "PREVENTED",
      reason: "Fleet has 19 Strength, below the 20 required to colonize",
    })
    expect(intents[3]?.actionOutcomes.at(-1)).toMatchObject({
      type: "PREVENTED",
      reason: expect.stringContaining("destroyed before colonization"),
    })
    expect(rng.getState()).toStrictEqual({ generatorState: 1831565813, spareNormal: null })

    const singletonRng = createSeededRng(0)
    const singletonTarget = planet("invalid-singleton-target", null, 0)
    const singletonFleetB = fleet("invalid-singleton-b", PLAYER_B, singletonTarget, 35)
    const singletonFleetC = fleet("invalid-singleton-c", PLAYER_C, singletonTarget, 19)
    const singletonDeadFleet = fleet("invalid-singleton-dead", PLAYER_A, singletonTarget, 35)
    const singletonIntents = [
      intent({ fleet: singletonDeadFleet, action: deadAction, target: singletonTarget, tick: 4, colonizeDefinition }),
      intent({ fleet: singletonFleetC, action: actionC, target: singletonTarget, tick: 4, colonizeDefinition }),
      intent({ fleet: singletonFleetB, action: actionB, target: singletonTarget, tick: 4, colonizeDefinition }),
    ]
    const singleton = resolveColonizeOnly({
      planets: [singletonTarget],
      fleets: [singletonFleetB, singletonFleetC],
      intents: singletonIntents,
      rng: singletonRng,
    })
    expect(singleton.context.turnState.planets[singletonTarget.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(singleton.context.turnState.fleets[singletonFleetB.id]?.strength).toBe(15)
    expect(singletonIntents[0]?.actionOutcomes.at(-1)).toMatchObject({
      type: "PREVENTED",
      reason: expect.stringContaining("destroyed before colonization"),
    })
    expect(singletonIntents[1]?.actionOutcomes.at(-1)).toMatchObject({
      type: "PREVENTED",
      reason: "Fleet has 19 Strength, below the 20 required to colonize",
    })
    expect(singletonIntents[2]?.actionOutcomes.at(-1)).toMatchObject({ type: "RESOLVED" })
    expect(singletonRng.getState()).toStrictEqual({ generatorState: 0, spareNormal: null })
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
    expect(claimantTurn.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(25)

    const finalTurn = resolveContinuation(claimantTurn, 4)
    expect(finalTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(finalTurn.fleets[journey.id]).toMatchObject({ originPlanetId: target.id, strength: 35, movement: undefined })
    expect(finalTurn.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(25)
    expect(finalTurn.resolvedContinuations[0]?.actionOutcomes.at(-1)).toMatchObject({ type: "PREVENTED" })
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

    const resolved = resolve({
      planets: [target, originOrdinary, originLate, originEarly],
      fleets: [survivor, ordinarySource, lateSource, earlySource],
      submissions,
      ruleset,
    })

    expect(resolved.planets[target.id]?.ownerPlayerId).toBe(PLAYER_B)
    expect(resolved.fleets[survivor.id]).toMatchObject({
      id: survivor.id,
      name: survivor.name,
      strength: 40,
      originPlanetId: target.id,
      arrivedAtTick: 2,
    })
    expect(fleetAtPlanetForOwner(resolved, target.id, PLAYER_B)).toMatchObject({ strength: 15, arrivedAtTick: 6 })
    expect(resolved.fleets[ordinarySource.id]?.strength).toBe(5)
    expect(resolved.fleets[lateSource.id]?.strength).toBe(5)
    expect(resolved.fleets[earlySource.id]?.strength).toBe(10)
    expect(
      Object.values(resolved.fleets)
        .filter(({ ownerPlayerId }) => ownerPlayerId === PLAYER_B)
        .map(({ strength }) => strength)
        .toSorted((first, second) => first - second),
    ).toStrictEqual([10, 15])
    expect(resolved.removedFleetIds).toHaveLength(2)
    expect(outcomeFor(resolved, PLAYER_B, "EARLY_1").type).toBe("RESOLVED")
    expect(outcomeFor(resolved, PLAYER_A, "LATE_1").type).toBe("PREVENTED")

    const lateTickTarget = planet("merge-late-tick-target", null, 1)
    const lateTickOrigin = planet("merge-late-tick-origin", PLAYER_A, 0.2)
    const lateTickSource = fleet("merge-late-tick-source", PLAYER_A, lateTickOrigin, 25)
    const lateTickRuleset = createRuleset([late], [{ id: "LATE_TICK_ONLY_1", actionDefinitionId: late.id }])
    const lateTickResolved = resolve({
      planets: [lateTickOrigin, lateTickTarget],
      fleets: [lateTickSource],
      submissions: [
        submit({
          id: "LATE_TICK_ONLY_1",
          playerId: PLAYER_A,
          actionDefinitionId: late.id,
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

    const laterEnemy = createColonizeMoveAction({ id: "TEST_COLONIZE_SPEED_ONE_CONTROL", speed: 1 })
    const laterRuleset = createRuleset(
      [ordinary, late, laterEnemy],
      [
        { id: "ORDINARY_CONTROL_1", actionDefinitionId: ordinary.id },
        { id: "LATE_FRIENDLY_1", actionDefinitionId: late.id },
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
          actionDefinitionId: ordinary.id,
          source: laterOrdinarySource,
          target: laterTarget,
          strength: 10,
        }),
        submit({
          id: "LATE_FRIENDLY_1",
          playerId: PLAYER_A,
          actionDefinitionId: late.id,
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
    expect(laterResolved.fleets[laterEnemySource.id]?.strength).toBe(10)
    expect(
      Object.values(laterResolved.fleets)
        .filter(({ ownerPlayerId }) => ownerPlayerId === PLAYER_B)
        .map(({ strength }) => strength)
        .toSorted((first, second) => first - second),
    ).toStrictEqual([10, 35])
    expect(outcomeFor(laterResolved, PLAYER_A, "LATE_FRIENDLY_1").type).toBe("RESOLVED")
    expect(outcomeFor(laterResolved, PLAYER_B, "LATER_ENEMY_1").type).toBe("PREVENTED")
  })

  it("should merge both friendly Colonize arrivals before applying one shared survivor reservation", () => {
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

    const resolved = resolve({
      planets: [target, originEarly, originLate],
      fleets: [survivor, sourceEarly, sourceLate],
      submissions,
      ruleset,
    })
    const reversed = resolve({
      planets: [target, originEarly, originLate].toReversed(),
      fleets: [survivor, sourceEarly, sourceLate].toReversed(),
      submissions: submissions.toReversed(),
      ruleset,
    })
    expect(resolved.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(resolved.fleets[survivor.id]).toMatchObject({ strength: 30, arrivedAtTick: 4 })
    expect(resolved.fleets[sourceEarly.id]?.strength).toBe(5)
    expect(resolved.fleets[sourceLate.id]?.strength).toBe(5)
    expect(resolved.removedFleetIds).toHaveLength(2)
    expect(outcomeFor(resolved, PLAYER_A, "DUPLICATE_EARLY_1").type).toBe("RESOLVED")
    expect(outcomeFor(resolved, PLAYER_A, "DUPLICATE_LATE_1").type).toBe("PREVENTED")
    expect(reversed.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(reversed.fleets[survivor.id]?.strength).toBe(30)
    expect(outcomeFor(reversed, PLAYER_A, "DUPLICATE_EARLY_1")).toStrictEqual(outcomeFor(resolved, PLAYER_A, "DUPLICATE_EARLY_1"))

    const lateTickTarget = planet("duplicate-late-tick-target", null, 1)
    const lateTickOrigin = planet("duplicate-late-tick-origin", PLAYER_A, 1.8)
    const lateTickSource = fleet("duplicate-late-tick-source", PLAYER_A, lateTickOrigin, 25)
    const lateTickRuleset = createRuleset([late], [{ id: "DUPLICATE_LATE_TICK_1", actionDefinitionId: late.id }])
    const lateTickResolved = resolve({
      planets: [lateTickOrigin, lateTickTarget],
      fleets: [lateTickSource],
      submissions: [
        submit({
          id: "DUPLICATE_LATE_TICK_1",
          playerId: PLAYER_A,
          actionDefinitionId: late.id,
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
  })
})

type StandaloneColonizeScenario = {
  origin: Planet
  destination: Planet
  source: Fleet
  attacker: Fleet | undefined
  colonize: ReturnType<typeof createSubmittedActionStub>
  resolved: ResolvedTurnState
}

function runStandaloneColonizeWithMove(withAssault: boolean): StandaloneColonizeScenario {
  const origin = planet(`deferred-origin-${withAssault}`, null, 0)
  const destination = planet(`deferred-destination-${withAssault}`, null, 1)
  const source = fleet(`deferred-source-${withAssault}`, PLAYER_A, origin, 35)
  const move = submit({
    id: "MOVE_FLEET_STANDARD_1",
    playerId: PLAYER_A,
    actionDefinitionId: "MOVE_FLEET_STANDARD",
    source,
    target: destination,
    strength: 15,
  })
  const colonize = createSubmittedActionStub({
    id: ColonizeHereTest.id + "_1",
    playerId: PLAYER_A,
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: source.id, planet: origin.id },
  })
  const attacker = withAssault ? fleet(`deferred-attacker-${withAssault}`, PLAYER_B, origin, 1) : undefined
  const fleets = attacker === undefined ? [source] : [source, attacker]
  const assault =
    attacker === undefined
      ? []
      : [
          createSubmittedActionStub({
            id: "TEST_STATIONARY_ASSAULT_1",
            playerId: PLAYER_B,
            actionDefinitionId: "TEST_STATIONARY_ASSAULT",
            selectedTargets: { station: attacker.id, battlePlanet: origin.id },
          }),
        ]
  const submissions = [move, colonize, ...assault]

  return { origin, destination, source, attacker, colonize, resolved: resolve({ planets: [origin, destination], fleets, submissions }) }
}

function journeyTo(resolved: ResolvedTurnState, destinationPlanetId: string): Fleet | undefined {
  return Object.values(resolved.fleets).find(
    ({ destinationPlanetId: currentDestination, movement }) => movement !== undefined && currentDestination === destinationPlanetId,
  )
}

type ArrivalRace = {
  planets: Planet[]
  fleets: Fleet[]
  submissions: Array<ReturnType<typeof createSubmittedActionStub>>
  target: Planet
  firstSource: Fleet
  secondSource: Fleet
  firstAction: ReturnType<typeof createSubmittedActionStub>
  secondAction: ReturnType<typeof createSubmittedActionStub>
}

function createArrivalRace({ firstDistance, secondDistance }: { firstDistance: number; secondDistance: number }): ArrivalRace {
  const originA = planet("race-origin-a", PLAYER_A, 0)
  const target = planet("race-target", null, firstDistance)
  const firstSource = fleet("race-source-a", PLAYER_A, originA, 35)
  const originB = planet("race-origin-b", PLAYER_B, firstDistance - secondDistance)
  const secondSource = fleet("race-source-b", PLAYER_B, originB, 35)
  const firstAction = submit({
    id: ColonizePlanetTest.id + "_1",
    playerId: PLAYER_A,
    actionDefinitionId: ColonizePlanetTest.id,
    source: firstSource,
    target,
    strength: 35,
  })
  const secondAction = submit({
    id: ColonizePlanetTest.id + "_1",
    playerId: PLAYER_B,
    actionDefinitionId: ColonizePlanetTest.id,
    source: secondSource,
    target,
    strength: 35,
  })
  return {
    planets: [originA, originB, target],
    fleets: [firstSource, secondSource],
    submissions: [firstAction, secondAction],
    target,
    firstSource,
    secondSource,
    firstAction,
    secondAction,
  }
}

function createColonizeMoveAction({
  id,
  speed,
  withAssault = false,
}: {
  id: string
  speed: number
  withAssault?: boolean
}): ActionDefinition {
  const move = FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed })
  const colonize = FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 })
  const effects: ActionDefinition["effects"] = [colonize, move]
  if (withAssault) {
    effects.push(FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }))
  }
  return ActionDefinitionSchema.parse({ ...ColonizePlanetTest, id, name: id, effects })
}

function createMovementAction({ id, speed }: { id: string; speed: number }): ActionDefinition {
  return ActionDefinitionSchema.parse({
    ...ColonizePlanetTest,
    id,
    name: id,
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed })],
  })
}

function createRuleset(
  definitions: readonly ActionDefinition[],
  poolEntries: ReadonlyArray<Readonly<{ id: string; actionDefinitionId: string }>>,
): ReturnType<typeof Ruleset.create> {
  const actionDefinitions = { ...TestRuleset.actionDefinitions, ...indexBy("id", definitions) }
  return Ruleset.create({
    ...TestRuleset,
    actionDefinitions,
    actionPool: [...TestRuleset.actionPool, ...poolEntries],
  })
}

function resolve({
  planets,
  fleets,
  submissions,
  ruleset = TestRuleset,
  rng = createSeededRng(1234),
  turn = 1,
  colonyStockpile = 0,
}: {
  planets: readonly Planet[]
  fleets: readonly Fleet[]
  submissions: Array<ReturnType<typeof createSubmittedActionStub>>
  ruleset?: ReturnType<typeof Ruleset.create>
  rng?: ReturnType<typeof createSeededRng>
  turn?: number
  colonyStockpile?: number
}): ResolvedTurnState {
  const result = resolveTurn(
    createTurnStateStub({
      gameId: typedParse(GameIdSchema, 57),
      turn,
      submittedActions: submissions,
      players: indexBy(
        "id",
        [PLAYER_A, PLAYER_B, PLAYER_C].map((id) => ({
          id,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 50,
            [ResourceType.METAL]: 100,
            [ResourceType.FUEL]: 100,
            [ResourceType.ENERGY]: 0,
            [ResourceType.COLONY]: colonyStockpile,
          }),
        })),
      ),
      planets: indexBy("id", structuredClone([...planets])),
      fleets: indexBy("id", structuredClone([...fleets])),
    }),
    ruleset,
    rng,
  )
  Assert.isSuccess(result)
  return result.value
}

function resolveContinuation(
  previous: ResolvedTurnState,
  turn: number,
  rng = createSeededRng(1234),
  ruleset = TestRuleset,
): ResolvedTurnState {
  const fleets = Object.values(previous.fleets).map((fleetValue) =>
    fleetValue.movement === undefined ? fleetValue : FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue))),
  )
  const result = resolveTurn(
    createTurnStateStub({
      gameId: previous.gameId,
      turn,
      players: previous.players,
      planets: previous.planets,
      fleets: indexBy("id", fleets),
    }),
    ruleset,
    rng,
  )
  Assert.isSuccess(result)
  return result.value
}

function resolveColonizeOnly({
  planets,
  fleets,
  intents,
  rng,
}: {
  planets: readonly Planet[]
  fleets: readonly Fleet[]
  intents: PendingArrivalColonizationIntent[]
  rng: ReturnType<typeof createSeededRng>
}): { context: TurnContext } {
  const state = createTurnStateStub({
    gameId: typedParse(GameIdSchema, 58),
    turn: 2,
    players: indexBy(
      "id",
      [PLAYER_A, PLAYER_B].map((id) => ({
        id,
        resources: createResourcesStub({ [ResourceType.INFLUENCE]: 100 }),
      })),
    ),
    planets: indexBy("id", planets),
    fleets: indexBy("id", fleets),
  })
  const context: TurnContext = {
    rng,
    turnState: state,
    effectPool: new EffectPool([]),
    ruleset: TestRuleset,
    previousJourneyFleetIds: [],
    newDepartureFleetIds: new Set(),
    removedFleetIds: new Set(),
    changedPlanetIds: new Set(),
    resolvedContinuations: [],
    pendingArrivalAssaults: [],
    pendingArrivalColonizations: intents,
    fleetIdRebindings: new Map(),
  }
  const result = resolveColonizationPhase(context)
  Assert.isSuccess(result)
  return { context }
}

function intent({
  fleet: targetFleet,
  action,
  target,
  tick,
  colonizeDefinition,
}: {
  fleet: Fleet
  action: ReturnType<typeof createSubmittedActionStub>
  target: Planet
  tick: number
  colonizeDefinition: ReturnType<typeof FleetColonizeEffectDefinition.create>
}): PendingArrivalColonizationIntent {
  return {
    effectDefinition: colonizeDefinition,
    definitionOrdinal: typedParse(NonNegativeSafeIntegerSchema, 2),
    submittedAction: action,
    departureTurn: typedParse(PositiveIntegerSchema, 1),
    initiatingJourneyId: targetFleet.id,
    actualFleetId: targetFleet.id,
    planetId: target.id,
    tick,
    actionOutcomes: [],
  }
}

function planet(id: string, ownerPlayerId: PlayerId | null, x: number): Planet {
  return createPlanetStub({ id, ownerPlayerId, name: id, x, y: 0 })
}

function fleet(id: string, ownerPlayerId: PlayerId, origin: Planet, strength: number): Fleet {
  return createFleetStub({ id, ownerPlayerId, originPlanetId: origin.id, name: id, strength })
}

function submit({
  id,
  playerId,
  actionDefinitionId,
  source,
  target,
  strength,
}: {
  id: string
  playerId: PlayerId
  actionDefinitionId: string
  source: Fleet
  target: Planet
  strength: number
}): ReturnType<typeof createSubmittedActionStub> {
  return createSubmittedActionStub({
    id,
    playerId,
    actionDefinitionId,
    selectedTargets: { fleet: source.id, planet: target.id },
    selectedInputs: { strength },
  })
}

function outcomeFor(result: ResolvedTurnState, playerId: PlayerId, actionId: string): EffectOutcome {
  const action = result.resolvedActions.find(
    ({ submittedAction }) => submittedAction.playerId === playerId && submittedAction.id === actionId,
  )
  const outcome = action?.actionOutcomes.at(-1)
  if (outcome === undefined) {
    throw new Error(`Expected an outcome for ${playerId}/${actionId}`)
  }
  return outcome
}

function outcomesFor(result: ResolvedTurnState, playerId: PlayerId, actionId: string): readonly EffectOutcome[] {
  return (
    result.resolvedActions.find(({ submittedAction }) => submittedAction.playerId === playerId && submittedAction.id === actionId)
      ?.actionOutcomes ?? []
  )
}

function fleetAtPlanetForOwner(result: ResolvedTurnState, planetId: string, ownerPlayerId: PlayerId): Fleet | undefined {
  return Object.values(result.fleets).find(
    ({ originPlanetId, ownerPlayerId: currentOwnerId }) => originPlanetId === planetId && currentOwnerId === ownerPlayerId,
  )
}

function fleetStrengthForOwner(result: ResolvedTurnState, ownerPlayerId: PlayerId): number | undefined {
  const strengths = Object.values(result.fleets)
    .filter(({ ownerPlayerId: fleetOwnerId }) => fleetOwnerId === ownerPlayerId)
    .map(({ strength }) => strength)
  return strengths.length === 1 ? strengths[0] : undefined
}
