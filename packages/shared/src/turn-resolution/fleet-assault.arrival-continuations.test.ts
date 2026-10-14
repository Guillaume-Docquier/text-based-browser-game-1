import { type Success, Assert, branded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import type { NonNegativeNumber, PositiveNumber } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import type { NonNegativeSafeInteger } from "#shared/domain/NonNegativeSafeInteger.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import type { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import type { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetSchema, type Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { FleetName } from "#shared/domain/world/fleets/FleetName.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { FlexibleAssaultTest, StationaryAssaultTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "#shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import { assertAttackerA } from "./fleet-assault.assertions.test-support.ts"
import { PLAYER_A, PLAYER_B, PLAYER_C, resolve, planet, fleet, ownerStrengths } from "./fleet-assault.test-support.ts"

describe("Fleet Assault", () => {
  it("should capture arbitrary-tag Assault rules through JSON reload and resolves them on the actual arrival turn", () => {
    // Arrange

    const createOriginSetupPhase1Result = createOriginSetup()
    const { defender } = createOriginSetupPhase1Result

    const createFirstTurnSetupPhase2Result = createFirstTurnSetup({ ...createOriginSetupPhase1Result })
    const { firstTurn } = createFirstTurnSetupPhase2Result
    let { reloadedFleets } = createFirstTurnSetupPhase2Result
    const secondTurn = resolveTurn(
      createTurnStateStub({
        turn: 2,
        players: firstTurn.value.players,
        planets: firstTurn.value.planets,
        fleets: reloadedFleets,
      }),
      TestRuleset,
      createSeededRng(),
    )
    Assert.isSuccess(secondTurn)
    const reloadedAfterSecondAdvance = Object.values(secondTurn.value.fleets).map((fleetValue) =>
      FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue))),
    )
    reloadedFleets = indexBy("id", reloadedAfterSecondAdvance)
    const thirdTurn = resolveTurn(
      createTurnStateStub({
        turn: 3,
        players: secondTurn.value.players,
        planets: secondTurn.value.planets,
        fleets: reloadedFleets,
      }),
      TestRuleset,
      createSeededRng(),
    )
    Assert.isSuccess(thirdTurn)

    // Assert
    expect(thirdTurn.value.fleets[defender.id]).toBeUndefined()
    expect(ownerStrengths(thirdTurn.value.fleets, PLAYER_A)).toStrictEqual([10, 20])
    expect(thirdTurn.value.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(93)
    expect(thirdTurn.value.players[PLAYER_A]?.resources[ResourceType.FUEL]).toBe(98)
    expect(thirdTurn.value.resolvedContinuations).toHaveLength(1)
    expect(thirdTurn.value.resolvedContinuations[0]?.actionOutcomes.at(-1)?.type).toBe("RESOLVED")
    expect(Object.values(thirdTurn.value.fleets).find(({ strength }) => strength === 10)?.movement).toBeUndefined()
  })

  it("should reject a persisted pending Assault whose binding ordinal no longer matches its Action", () => {
    // Arrange
    const origin = planet("corrupt-origin", PLAYER_A, 0)
    const target = planet("corrupt-target", PLAYER_B, 5)
    const attacker = fleet("corrupt-attacker", PLAYER_A, origin, 50)
    const submission = createSubmittedActionStub({
      id: FlexibleAssaultTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: FlexibleAssaultTest.id,
      selectedTargets: { source: attacker.id, destination: target.id },
      selectedInputs: { force: 30 },
    })
    const firstTurn = resolveTurn(
      createTurnStateStub({
        submittedActions: [submission],
        players: indexBy(
          "id",
          [PLAYER_A, PLAYER_B, PLAYER_C].map((id) => ({
            id,
            resources: createResourcesStub({
              [ResourceType.INFLUENCE]: 100,
              [ResourceType.FUEL]: 100,
            }),
          })),
        ),
        planets: indexBy("id", [origin, target]),
        fleets: indexBy("id", [attacker]),
      }),
      TestRuleset,
      createSeededRng(),
    )
    Assert.isSuccess(firstTurn)
    const journey = Object.values(firstTurn.value.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(journey)
    Assert.isDefined(journey.movement)
    const pendingAssault = journey.movement.pendingArrivalEffects[0]
    Assert.isDefined(pendingAssault)

    verifyCorruptPendingAssault({ pendingAssault, journey, firstTurn })
  })

  it("should assign Build names canonically across owners and mixed-case pooled IDs", () => {
    // Arrange
    const alicePlanetB = planet("alice-build-b", PLAYER_A, 0)
    const alicePlanetA = planet("alice-build-a", PLAYER_A, 1)
    const bobPlanetB = planet("bob-build-b", PLAYER_B, 2)
    const bobPlanetA = planet("bob-build-a", PLAYER_B, 3)
    const ruleset = Ruleset.create({
      ...TestRuleset,
      actionPool: [
        ...TestRuleset.actionPool,
        { id: "B!", actionDefinitionId: BuildFleetStandard.id },
        { id: "a:", actionDefinitionId: BuildFleetStandard.id },
      ],
    })
    const build = (id: string, playerId: PlayerId, target: Planet): ReturnType<typeof createSubmittedActionStub> =>
      createSubmittedActionStub({
        id,
        playerId,
        actionDefinitionId: BuildFleetStandard.id,
        selectedTargets: { planet: target.id },
      })
    const submissions = [
      build("B!", PLAYER_A, alicePlanetB),
      build("a:", PLAYER_A, alicePlanetA),
      build("B!", PLAYER_B, bobPlanetB),
      build("a:", PLAYER_B, bobPlanetA),
    ]
    // Act
    const forwardRng = createSeededRng(1234)
    const reversedRng = createSeededRng(1234)

    verifyForward({ alicePlanetB, alicePlanetA, bobPlanetB, bobPlanetA, submissions, forwardRng, ruleset, reversedRng })
    expect(reversedRng.getState()).toStrictEqual({ generatorState: 3031297190, spareNormal: null })
  })

  it("should keep mixed-owner Build names, Assault rounding, order, and RNG stable under input permutations", () => {
    expect.hasAssertions()
    // Arrange
    const aliceBuildB = planet("alice-build-b", PLAYER_A, 0)
    const aliceBuildA = planet("alice-build-a", PLAYER_A, 1)
    const bobBuildB = planet("bob-build-b", PLAYER_B, 2)
    const bobBuildA = planet("bob-build-a", PLAYER_B, 3)
    const battle = planet("permutation-battle", PLAYER_C, 4)
    const attackerA = fleet("permutation-attacker-a", PLAYER_A, battle, 30)
    const attackerB = fleet("permutation-attacker-b", PLAYER_B, battle, 20)
    const defenderC = fleet("permutation-defender-c", PLAYER_C, battle, 10)
    const sharedActionPool: ReturnType<typeof Ruleset.create>["actionPool"] = [
      { id: branded<ActionId>("B!"), actionDefinitionId: BuildFleetStandard.id },
      { id: branded<ActionId>("a:"), actionDefinitionId: BuildFleetStandard.id },
    ]
    const actionPool = [...TestRuleset.actionPool, ...sharedActionPool]
    const build = (id: string, playerId: PlayerId, destination: Planet): ReturnType<typeof createSubmittedActionStub> =>
      createSubmittedActionStub({
        id,
        playerId,
        actionDefinitionId: BuildFleetStandard.id,
        selectedTargets: { planet: destination.id },
        selectedInputs: {},
      })
    const assault = (
      playerId: PlayerId,
      source: Fleet,
      selectedTargets: Record<string, string>,
    ): ReturnType<typeof createSubmittedActionStub> =>
      createSubmittedActionStub({
        id: StationaryAssaultTest.id + "_1",
        playerId,
        actionDefinitionId: StationaryAssaultTest.id,
        selectedTargets,
        selectedInputs: {},
      })
    const forwardSubmissions = [
      build("B!", PLAYER_A, aliceBuildB),
      build("a:", PLAYER_A, aliceBuildA),
      build("B!", PLAYER_B, bobBuildB),
      build("a:", PLAYER_B, bobBuildA),
      assault(PLAYER_A, attackerA, { station: attackerA.id, battlePlanet: battle.id }),
      assault(PLAYER_B, attackerB, { battlePlanet: battle.id, station: attackerB.id }),
    ]

    verifyReversedSubmissions({
      assault,
      attackerB,
      battle,
      attackerA,
      build,
      bobBuildA,
      bobBuildB,
      aliceBuildA,
      aliceBuildB,
      defenderC,
      forwardSubmissions,
      actionPool,
    })
  })
})

function verifyCorruptPendingAssault({ pendingAssault, journey, firstTurn }: VerifyCorruptPendingAssaultInput): void {
  Assert.isDefined(journey.movement)
  const corruptPendingAssault = Object.assign({ ...pendingAssault }, { definitionOrdinal: pendingAssault.definitionOrdinal + 1 })
  const corruptJourney = {
    ...journey,
    movement: {
      ...journey.movement,
      pendingArrivalEffects: [corruptPendingAssault],
    },
  }
  // Act
  const continued = resolveTurn(
    createTurnStateStub({
      turn: 2,
      players: firstTurn.value.players,
      planets: firstTurn.value.planets,
      fleets: indexBy("id", [...Object.values(firstTurn.value.fleets).filter(({ id }) => id !== corruptJourney.id), corruptJourney]),
    }),
    TestRuleset,
    createSeededRng(),
  )

  // Assert
  expect(Result.isFailure(continued)).toBe(true)
}

function verifyForward({
  alicePlanetB,
  alicePlanetA,
  bobPlanetB,
  bobPlanetA,
  submissions,
  forwardRng,
  ruleset,
  reversedRng,
}: VerifyForwardInput): void {
  const forward = resolve({
    planets: [alicePlanetB, alicePlanetA, bobPlanetB, bobPlanetA],
    fleets: [],
    submissions,
    rng: forwardRng,
    ruleset,
  })
  const reversed = resolve({
    planets: [bobPlanetA, bobPlanetB, alicePlanetA, alicePlanetB],
    fleets: [],
    submissions: submissions.toReversed(),
    rng: reversedRng,
    ruleset,
  })
  const expectedNames = [
    [alicePlanetB.id, "fleet 74220"],
    [alicePlanetA.id, "fleet 703708"],
    [bobPlanetB.id, "fleet 902953"],
    [bobPlanetA.id, "fleet 970578"],
  ] as const

  // Assert
  for (const result of [forward, reversed]) {
    for (const [planetId, name] of expectedNames) {
      const builtFleet = Object.values(result.fleets).find(({ originPlanetId }) => originPlanetId === planetId)
      Assert.isDefined(builtFleet)
      expect(builtFleet.name).toBe(name)
    }
  }
  expect(forwardRng.getState()).toStrictEqual({ generatorState: 3031297190, spareNormal: null })
}

function verifyReversedSubmissions({
  assault,
  attackerB,
  battle,
  attackerA,
  build,
  bobBuildA,
  bobBuildB,
  aliceBuildA,
  aliceBuildB,
  defenderC,
  forwardSubmissions,
  actionPool,
}: VerifyReversedSubmissionsInput): void {
  const reversedSubmissions = [
    assault(PLAYER_B, attackerB, { station: attackerB.id, battlePlanet: battle.id }),
    assault(PLAYER_A, attackerA, { battlePlanet: battle.id, station: attackerA.id }),
    build("a:", PLAYER_B, bobBuildA),
    build("B!", PLAYER_B, bobBuildB),
    build("a:", PLAYER_A, aliceBuildA),
    build("B!", PLAYER_A, aliceBuildB),
  ]
  const planets = [aliceBuildB, aliceBuildA, bobBuildB, bobBuildA, battle]
  const fleets = [attackerA, attackerB, defenderC]

  assertAttackerA({
    attackerA,
    battle,
    attackerB,
    planets,
    fleets,
    forwardSubmissions,
    actionPool,
    reversedSubmissions,
    defenderC,
    aliceBuildB,
    aliceBuildA,
    bobBuildB,
    bobBuildA,
  })
}

type VerifyCorruptPendingAssaultInput = {
  pendingAssault:
    | Readonly<{ effectDefinition: FleetAssaultEffectDefinition; definitionOrdinal: NonNegativeSafeInteger }>
    | Readonly<{ effectDefinition: FleetColonizeEffectDefinition; definitionOrdinal: NonNegativeSafeInteger }>
  journey: ResolutionFleet
  firstTurn: Success<ResolvedTurnState>
}

type VerifyForwardInput = {
  alicePlanetB: ReturnType<typeof createPlanetStub>
  alicePlanetA: ReturnType<typeof createPlanetStub>
  bobPlanetB: ReturnType<typeof createPlanetStub>
  bobPlanetA: ReturnType<typeof createPlanetStub>
  submissions: Array<
    Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
  >
  forwardRng: ReturnType<typeof createSeededRng>
  ruleset: Ruleset
  reversedRng: ReturnType<typeof createSeededRng>
}

type VerifyReversedSubmissionsInput = {
  assault: AssaultCallback
  attackerB: ReturnType<typeof createFleetStub>
  battle: ReturnType<typeof createPlanetStub>
  attackerA: ReturnType<typeof createFleetStub>
  build: BuildCallback
  bobBuildA: ReturnType<typeof createPlanetStub>
  bobBuildB: ReturnType<typeof createPlanetStub>
  aliceBuildA: ReturnType<typeof createPlanetStub>
  aliceBuildB: ReturnType<typeof createPlanetStub>
  defenderC: ReturnType<typeof createFleetStub>
  forwardSubmissions: Array<
    Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
  >
  actionPool: Array<Readonly<{ id: ActionId; actionDefinitionId: ActionDefinitionId }>>
}

function createOriginSetup(): CreateOriginSetupResult {
  const origin = planet("reload-origin", PLAYER_A, 0)
  const target = planet("reload-target", PLAYER_B, 5)
  const attacker = fleet("reload-attacker", PLAYER_A, origin, 50)
  const defender = fleet("reload-defender", PLAYER_B, target, 20)
  const submission = createSubmittedActionStub({
    id: FlexibleAssaultTest.id + "_1",
    playerId: PLAYER_A,
    actionDefinitionId: FlexibleAssaultTest.id,
    selectedTargets: { source: attacker.id, destination: target.id },
    selectedInputs: { force: 30 },
  })
  const players = indexBy(
    "id",
    [PLAYER_A, PLAYER_B, PLAYER_C].map((id) => ({
      id,
      resources: createResourcesStub({
        [ResourceType.INFLUENCE]: 100,
        [ResourceType.FUEL]: 100,
      }),
    })),
  )
  return { origin, target, attacker, defender, submission, players }
}

function createFirstTurnSetup({
  submission,
  players,
  origin,
  target,
  attacker,
  defender,
}: CreateFirstTurnSetupInput): CreateFirstTurnSetupResult {
  const firstTurn = resolveTurn(
    createTurnStateStub({
      turn: 1,
      submittedActions: [submission],
      players,
      planets: indexBy("id", [origin, target]),
      fleets: indexBy("id", [attacker, defender]),
    }),
    TestRuleset,
    createSeededRng(),
  )
  Assert.isSuccess(firstTurn)

  const inTransit = Object.values(firstTurn.value.fleets).find(({ movement }) => movement !== undefined)
  Assert.isDefined(inTransit)
  Assert.isDefined(inTransit.movement)
  expect(inTransit.strength).toBe(30)
  expect(inTransit.distanceToEnd).toBe(3)
  expect(inTransit.movement.pendingArrivalEffects).toHaveLength(1)
  expect(inTransit.movement.pendingArrivalEffects[0]?.definitionOrdinal).toBe(3)
  expect(inTransit.movement.pendingArrivalEffects[0]?.effectDefinition.targets.fleet.actionTargetTag).toBe("source")
  expect(firstTurn.value.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(93)
  expect(firstTurn.value.players[PLAYER_A]?.resources[ResourceType.FUEL]).toBe(98)

  // Act
  const reloadedFleets = indexBy(
    "id",
    Object.values(firstTurn.value.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue)))),
  )
  return { firstTurn, reloadedFleets }
}

type CreateOriginSetupResult = {
  origin: ReturnType<typeof createPlanetStub>
  target: ReturnType<typeof createPlanetStub>
  attacker: ReturnType<typeof createFleetStub>
  defender: ReturnType<typeof createFleetStub>
  submission: ReturnType<typeof createSubmittedActionStub>
  players: Record<PlayerId, { id: PlayerId; resources: ReturnType<typeof createResourcesStub> }>
}

type CreateFirstTurnSetupInput = {
  submission: ReturnType<typeof createSubmittedActionStub>
  players: Record<PlayerId, { id: PlayerId; resources: ReturnType<typeof createResourcesStub> }>
  origin: ReturnType<typeof createPlanetStub>
  target: ReturnType<typeof createPlanetStub>
  attacker: ReturnType<typeof createFleetStub>
  defender: ReturnType<typeof createFleetStub>
}

type CreateFirstTurnSetupResult = {
  firstTurn: Success<ResolvedTurnState>
  reloadedFleets: Record<
    FleetId,
    {
      id: FleetId
      ownerPlayerId: PlayerId
      name: FleetName
      strength: NonNegativeSafeInteger
      originPlanetId: PlanetId
      destinationPlanetId?: undefined | PlanetId
      distanceToEnd?: undefined | NonNegativeNumber
      movement?:
        | undefined
        | {
            speed: PositiveNumber
            departureTurn: PositiveInteger
            submission: {
              id: ActionId
              playerId: PlayerId
              actionDefinitionId: ActionDefinitionId
              selectedTargets: Readonly<Record<TargetTag, PlayerId | FleetId | PlanetId>>
              selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
            }
            pendingArrivalEffects: ReadonlyArray<
              | {
                  effectDefinition: {
                    type: "FLEET_ASSAULT"
                    targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
                    parameters: Record<string, never>
                  }
                  definitionOrdinal: NonNegativeSafeInteger
                }
              | {
                  effectDefinition: {
                    type: "FLEET_COLONIZE"
                    targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
                    parameters: { strengthRequirement: PositiveInteger }
                  }
                  definitionOrdinal: NonNegativeSafeInteger
                }
            >
          }
    }
  >
}

type AssaultCallback = (
  playerId: PlayerId,
  source: ReturnType<typeof createFleetStub>,
  selectedTargets: Record<string, string>,
) => Readonly<{
  id: ActionId
  playerId: PlayerId
  actionDefinitionId: ActionDefinitionId
  selectedTargets: Readonly<Record<TargetTag, TargetId>>
  selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
}>

type BuildCallback = (
  id: string,
  playerId: PlayerId,
  destination: ReturnType<typeof createPlanetStub>,
) => Readonly<{
  id: ActionId
  playerId: PlayerId
  actionDefinitionId: ActionDefinitionId
  selectedTargets: Readonly<Record<TargetTag, TargetId>>
  selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
}>
