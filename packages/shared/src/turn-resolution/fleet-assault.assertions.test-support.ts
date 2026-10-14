import { Assert } from "@guillaume-docquier/tools-ts"
import { expect } from "vitest"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import type { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { StationaryAssaultTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import { PLAYER_A, PLAYER_B, PLAYER_C, resolve, compareNormalizedOutcome, lastOutcome } from "./fleet-assault.test-support.ts"

export function assertLastOutcome({
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
}: AssertLastOutcomeInput): void {
  expect(lastOutcome(noDefender, PLAYER_A)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("found no enemy Fleets"),
  })
  expect(lastOutcome(transitOnly, PLAYER_A)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("found no enemy Fleets"),
  })
  expect(noDefender.fleets[noDefenderAttacker.id]).toMatchObject({
    id: noDefenderAttacker.id,
    ownerPlayerId: PLAYER_A,
    name: noDefenderAttacker.name,
    originPlanetId: noDefenderBattle.id,
    strength: 30,
  })
  expect(noDefender.fleets[noDefenderAttacker.id]?.movement).toBeUndefined()
  expect(transitOnly.fleets[transitAttacker.id]).toMatchObject({
    id: transitAttacker.id,
    ownerPlayerId: PLAYER_A,
    name: transitAttacker.name,
    originPlanetId: transitBattle.id,
    strength: 30,
  })
  expect(transitOnly.fleets[transitAttacker.id]?.movement).toBeUndefined()
  expect(Object.values(transitOnly.fleets).some(({ id }) => id === departedSourceId)).toBe(false)
  expect(transitOnly.fleets[transitEnemy.id]).toMatchObject({
    id: transitEnemy.id,
    ownerPlayerId: PLAYER_B,
    name: transitEnemy.name,
    originPlanetId: transitBattle.id,
    destinationPlanetId: transitOther.id,
    distanceToEnd: 2,
    strength: 20,
    movement: {
      speed: 1,
      departureTurn: 1,
      submission: transitSubmission,
      pendingArrivalEffects: [],
    },
  })
  expect(noDefender.planets[noDefenderBattle.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(transitOnly.planets[transitBattle.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(transitOnly.planets[transitOther.id]?.ownerPlayerId).toBe(PLAYER_B)
  expect(noDefender.removedFleetIds).toStrictEqual([])
  expect(transitOnly.removedFleetIds).toStrictEqual([])
}

export type AssertLastOutcomeInput = {
  noDefender: ResolvedTurnState
  transitOnly: ResolvedTurnState
  noDefenderAttacker: ReturnType<typeof createFleetStub>
  noDefenderBattle: ReturnType<typeof createPlanetStub>
  transitAttacker: ReturnType<typeof createFleetStub>
  transitBattle: ReturnType<typeof createPlanetStub>
  departedSourceId: "transit-source"
  transitEnemy: ReturnType<typeof createFleetStub>
  transitOther: ReturnType<typeof createPlanetStub>
  transitSubmission: ReturnType<typeof createSubmittedActionStub>
}

export function assertSurvivor({ survivor, fixture, permutedSurvivor, permuted, permutedFixture, result }: AssertSurvivorInput): void {
  expect(survivor).toMatchObject({
    ownerPlayerId: PLAYER_A,
    name: fixture.earlierTwenty.name,
    strength: 25,
    originPlanetId: fixture.target.id,
  })
  expect(survivor.movement).toBeUndefined()
  expect(permutedSurvivor).toMatchObject({
    id: survivor.id,
    ownerPlayerId: PLAYER_A,
    name: fixture.earlierTwenty.name,
    strength: 25,
    originPlanetId: fixture.target.id,
  })
  expect(permutedSurvivor.movement).toBeUndefined()
  expect(permuted.fleets[permutedFixture.defender.id]).toBeUndefined()
  expect(permuted.removedFleetIds).toHaveLength(4)
  expect(permuted.removedFleetIds).toStrictEqual(
    expect.arrayContaining([permutedFixture.earlierTwenty.id, permutedFixture.laterFifteen.id, permutedFixture.defender.id]),
  )
  expect(permuted.removedFleetIds).toStrictEqual(result.removedFleetIds)
  expect(Object.values(permuted.fleets).toSorted((first, second) => compareOrdinalStrings(first.id, second.id))).toStrictEqual(
    Object.values(result.fleets).toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
  )
}

export type AssertSurvivorInput = {
  survivor: ResolutionFleet
  fixture: {
    origin: ReturnType<typeof createPlanetStub>
    target: ReturnType<typeof createPlanetStub>
    earlierTwenty: ReturnType<typeof createFleetStub>
    laterFifteen: ReturnType<typeof createFleetStub>
    defender: ReturnType<typeof createFleetStub>
    earlierSubmission: Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
    laterSubmission: Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
  }
  permutedSurvivor: ResolutionFleet
  permuted: ResolvedTurnState
  permutedFixture: {
    origin: ReturnType<typeof createPlanetStub>
    target: ReturnType<typeof createPlanetStub>
    earlierTwenty: ReturnType<typeof createFleetStub>
    laterFifteen: ReturnType<typeof createFleetStub>
    defender: ReturnType<typeof createFleetStub>
    earlierSubmission: Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
    laterSubmission: Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
  }
  result: ResolvedTurnState
}

export function assertAttackerA({
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
}: AssertAttackerAInput): void {
  expect(attackerA).toMatchObject({ strength: 30, ownerPlayerId: PLAYER_A, originPlanetId: battle.id })
  expect(attackerB).toMatchObject({ strength: 20, ownerPlayerId: PLAYER_B, originPlanetId: battle.id })

  // Act
  const forward = resolvePermutation({
    orderedPlanets: planets,
    orderedFleets: fleets,
    orderedSubmissions: forwardSubmissions,
    orderedActionPool: actionPool,
  })
  const reversed = resolvePermutation({
    orderedPlanets: planets.toReversed(),
    orderedFleets: fleets.toReversed(),
    orderedSubmissions: reversedSubmissions,
    orderedActionPool: actionPool.toReversed(),
  })

  // Assert
  for (const { resolved, rng } of [forward, reversed]) {
    expect(resolved.fleets[attackerA.id]).toMatchObject({ strength: 10, originPlanetId: battle.id, name: attackerA.name })
    expect(resolved.fleets[attackerB.id]).toBeUndefined()
    expect(resolved.fleets[defenderC.id]).toBeUndefined()
    expect(resolved.planets[battle.id]?.ownerPlayerId).toBe(PLAYER_C)
    const expectedBuilds = [
      [aliceBuildB.id, "fleet 74220"],
      [aliceBuildA.id, "fleet 703708"],
      [bobBuildB.id, "fleet 902953"],
      [bobBuildA.id, "fleet 970578"],
    ] as const
    for (const [planetId, expectedName] of expectedBuilds) {
      const builtFleet = Object.values(resolved.fleets).find(({ originPlanetId }) => originPlanetId === planetId)
      Assert.isDefined(builtFleet)
      expect(builtFleet.name).toBe(expectedName)
      expect(builtFleet.strength).toBe(10)
    }
    expect(resolved.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(96)
    expect(resolved.players[PLAYER_A]?.resources[ResourceType.METAL]).toBe(98)
    expect(resolved.players[PLAYER_B]?.resources[ResourceType.INFLUENCE]).toBe(96)
    expect(resolved.players[PLAYER_B]?.resources[ResourceType.METAL]).toBe(98)
    expect(lastOutcome(resolved, PLAYER_B, StationaryAssaultTest.id + "_1")).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("exchanged 20 Strength with 40 enemy Strength"),
    })
    expect(lastOutcome(resolved, PLAYER_A, StationaryAssaultTest.id + "_1")).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("exchanged 5 Strength with 5 enemy Strength"),
    })
    expect(rng.getState()).toStrictEqual({ generatorState: 567895707, spareNormal: null })
  }

  expect(normalize(forward)).toStrictEqual(normalize(reversed))
}

export type AssertAttackerAInput = {
  attackerA: ReturnType<typeof createFleetStub>
  battle: ReturnType<typeof createPlanetStub>
  attackerB: ReturnType<typeof createFleetStub>
  planets: Array<ReturnType<typeof createPlanetStub>>
  fleets: Array<ReturnType<typeof createFleetStub>>
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
  reversedSubmissions: Array<
    Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
  >
  defenderC: ReturnType<typeof createFleetStub>
  aliceBuildB: ReturnType<typeof createPlanetStub>
  aliceBuildA: ReturnType<typeof createPlanetStub>
  bobBuildB: ReturnType<typeof createPlanetStub>
  bobBuildA: ReturnType<typeof createPlanetStub>
}

function resolvePermutation({
  orderedPlanets,
  orderedFleets,
  orderedSubmissions,
  orderedActionPool,
}: {
  orderedPlanets: Planet[]
  orderedFleets: Fleet[]
  orderedSubmissions: Array<ReturnType<typeof createSubmittedActionStub>>
  orderedActionPool: ReturnType<typeof Ruleset.create>["actionPool"]
}): { resolved: ResolvedTurnState; rng: ReturnType<typeof createSeededRng> } {
  const ruleset = Ruleset.create({ ...TestRuleset, actionPool: orderedActionPool })
  const rng = createSeededRng(1234)
  const resolved = resolve({
    planets: structuredClone(orderedPlanets),
    fleets: structuredClone(orderedFleets),
    submissions: orderedSubmissions,
    rng,
    ruleset,
  })
  return { resolved, rng }
}

function normalize({ resolved, rng }: ReturnType<typeof resolvePermutation>): object {
  return {
    fleets: Object.values(resolved.fleets)
      .map(({ id, name, ownerPlayerId, strength, originPlanetId }) => ({ id, name, ownerPlayerId, strength, originPlanetId }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
    resources: Object.entries(resolved.players)
      .map(([playerId, player]) => ({ playerId, ...player.resources }))
      .toSorted((first, second) => compareOrdinalStrings(first.playerId, second.playerId)),
    outcomes: resolved.resolvedActions
      .map(({ submittedAction, actionOutcomes }) => ({
        playerId: submittedAction.playerId,
        actionId: submittedAction.id,
        outcomes: actionOutcomes,
      }))
      .toSorted(compareNormalizedOutcome),
    removedFleetIds: resolved.removedFleetIds.toSorted(compareOrdinalStrings),
    rngState: rng.getState(),
  }
}
