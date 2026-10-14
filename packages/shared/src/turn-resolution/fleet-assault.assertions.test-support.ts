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

export function assertLastOutcome(input: AssertLastOutcomeInput): void {
  expect(lastOutcome(input.noDefender, PLAYER_A)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("found no enemy Fleets"),
  })
  expect(lastOutcome(input.transitOnly, PLAYER_A)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("found no enemy Fleets"),
  })
  expect(input.noDefender.fleets[input.noDefenderAttacker.id]).toMatchObject({
    id: input.noDefenderAttacker.id,
    ownerPlayerId: PLAYER_A,
    name: input.noDefenderAttacker.name,
    originPlanetId: input.noDefenderBattle.id,
    strength: 30,
  })
  expect(input.noDefender.fleets[input.noDefenderAttacker.id]?.movement).toBeUndefined()
  expect(input.transitOnly.fleets[input.transitAttacker.id]).toMatchObject({
    id: input.transitAttacker.id,
    ownerPlayerId: PLAYER_A,
    name: input.transitAttacker.name,
    originPlanetId: input.transitBattle.id,
    strength: 30,
  })
  expect(input.transitOnly.fleets[input.transitAttacker.id]?.movement).toBeUndefined()
  expect(Object.values(input.transitOnly.fleets).some(({ id }) => id === input.departedSourceId)).toBe(false)
  expect(input.transitOnly.fleets[input.transitEnemy.id]).toMatchObject({
    id: input.transitEnemy.id,
    ownerPlayerId: PLAYER_B,
    name: input.transitEnemy.name,
    originPlanetId: input.transitBattle.id,
    destinationPlanetId: input.transitOther.id,
    distanceToEnd: 2,
    strength: 20,
    movement: {
      speed: 1,
      departureTurn: 1,
      submission: input.transitSubmission,
      pendingArrivalEffects: [],
    },
  })
  expect(input.noDefender.planets[input.noDefenderBattle.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(input.transitOnly.planets[input.transitBattle.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(input.transitOnly.planets[input.transitOther.id]?.ownerPlayerId).toBe(PLAYER_B)
  expect(input.noDefender.removedFleetIds).toStrictEqual([])
  expect(input.transitOnly.removedFleetIds).toStrictEqual([])
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

export function assertSurvivor(input: AssertSurvivorInput): void {
  expect(input.survivor).toMatchObject({
    ownerPlayerId: PLAYER_A,
    name: input.fixture.earlierTwenty.name,
    strength: 25,
    originPlanetId: input.fixture.target.id,
  })
  expect(input.survivor.movement).toBeUndefined()
  expect(input.permutedSurvivor).toMatchObject({
    id: input.survivor.id,
    ownerPlayerId: PLAYER_A,
    name: input.fixture.earlierTwenty.name,
    strength: 25,
    originPlanetId: input.fixture.target.id,
  })
  expect(input.permutedSurvivor.movement).toBeUndefined()
  expect(input.permuted.fleets[input.permutedFixture.defender.id]).toBeUndefined()
  expect(input.permuted.removedFleetIds).toHaveLength(4)
  expect(input.permuted.removedFleetIds).toStrictEqual(
    expect.arrayContaining([
      input.permutedFixture.earlierTwenty.id,
      input.permutedFixture.laterFifteen.id,
      input.permutedFixture.defender.id,
    ]),
  )
  expect(input.permuted.removedFleetIds).toStrictEqual(input.result.removedFleetIds)
  expect(Object.values(input.permuted.fleets).toSorted((first, second) => compareOrdinalStrings(first.id, second.id))).toStrictEqual(
    Object.values(input.result.fleets).toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
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

export function assertAttackerA(input: AssertAttackerAInput): void {
  expect(input.attackerA).toMatchObject({ strength: 30, ownerPlayerId: PLAYER_A, originPlanetId: input.battle.id })
  expect(input.attackerB).toMatchObject({ strength: 20, ownerPlayerId: PLAYER_B, originPlanetId: input.battle.id })

  // Act
  const forward = resolvePermutation({
    orderedPlanets: input.planets,
    orderedFleets: input.fleets,
    orderedSubmissions: input.forwardSubmissions,
    orderedActionPool: input.actionPool,
  })
  const reversed = resolvePermutation({
    orderedPlanets: input.planets.toReversed(),
    orderedFleets: input.fleets.toReversed(),
    orderedSubmissions: input.reversedSubmissions,
    orderedActionPool: input.actionPool.toReversed(),
  })

  // Assert
  for (const { resolved, rng } of [forward, reversed]) {
    expect(resolved.fleets[input.attackerA.id]).toMatchObject({ strength: 10, originPlanetId: input.battle.id, name: input.attackerA.name })
    expect(resolved.fleets[input.attackerB.id]).toBeUndefined()
    expect(resolved.fleets[input.defenderC.id]).toBeUndefined()
    expect(resolved.planets[input.battle.id]?.ownerPlayerId).toBe(PLAYER_C)
    const expectedBuilds = [
      [input.aliceBuildB.id, "fleet 74220"],
      [input.aliceBuildA.id, "fleet 703708"],
      [input.bobBuildB.id, "fleet 902953"],
      [input.bobBuildA.id, "fleet 970578"],
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

function resolvePermutation(input: {
  orderedPlanets: Planet[]
  orderedFleets: Fleet[]
  orderedSubmissions: Array<ReturnType<typeof createSubmittedActionStub>>
  orderedActionPool: ReturnType<typeof Ruleset.create>["actionPool"]
}): { resolved: ResolvedTurnState; rng: ReturnType<typeof createSeededRng> } {
  const ruleset = Ruleset.create({ ...TestRuleset, actionPool: input.orderedActionPool })
  const rng = createSeededRng(1234)
  const resolved = resolve({
    planets: structuredClone(input.orderedPlanets),
    fleets: structuredClone(input.orderedFleets),
    submissions: input.orderedSubmissions,
    rng,
    ruleset,
  })
  return { resolved, rng }
}

function normalize(input: ReturnType<typeof resolvePermutation>): object {
  return {
    fleets: Object.values(input.resolved.fleets)
      .map(({ id, name, ownerPlayerId, strength, originPlanetId }) => ({ id, name, ownerPlayerId, strength, originPlanetId }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
    resources: Object.entries(input.resolved.players)
      .map(([playerId, player]) => ({ playerId, ...player.resources }))
      .toSorted((first, second) => compareOrdinalStrings(first.playerId, second.playerId)),
    outcomes: input.resolved.resolvedActions
      .map(({ submittedAction, actionOutcomes }) => ({
        playerId: submittedAction.playerId,
        actionId: submittedAction.id,
        outcomes: actionOutcomes,
      }))
      .toSorted(compareNormalizedOutcome),
    removedFleetIds: input.resolved.removedFleetIds.toSorted(compareOrdinalStrings),
    rngState: input.rng.getState(),
  }
}
