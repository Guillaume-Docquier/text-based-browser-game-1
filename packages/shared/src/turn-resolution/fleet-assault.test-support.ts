import { Assert, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { AttackMoveTest, StationaryAssaultTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

export const PLAYER_A = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")

export const PLAYER_B = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000002")

export const PLAYER_C = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000003")

export const SpeedTwoAttackMoveTest = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_SPEED_TWO_ATTACK_MOVE",
  name: "Speed Two Attack Move",
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 2 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
  ],
})

export const SpeedTwoAttackMoveRuleset = Ruleset.create({
  ...TestRuleset,
  actionDefinitions: {
    ...TestRuleset.actionDefinitions,
    [SpeedTwoAttackMoveTest.id]: SpeedTwoAttackMoveTest,
  },
  actionPool: [...TestRuleset.actionPool, { id: SpeedTwoAttackMoveTest.id + "_1", actionDefinitionId: SpeedTwoAttackMoveTest.id }],
})

export type ResolveOptions = Readonly<{
  ruleset?: Ruleset
  turn?: number
  planets: readonly Planet[]
  fleets: readonly Fleet[]
  submissions: ReadonlyArray<ReturnType<typeof createSubmittedActionStub>>
  rng?: ReturnType<typeof createSeededRng>
}>

export function createPooledAssaultScenario(): {
  target: Planet
  attackerA: Fleet
  attackerB: Fleet
  submissionA: ReturnType<typeof stationaryAssault>
  submissionB: ReturnType<typeof stationaryAssault>
} {
  const target = planet("pooled-target", PLAYER_C, 0)
  const attackerA = fleet("pooled-attacker-a", PLAYER_A, target, 30)
  const attackerB = fleet("pooled-attacker-b", PLAYER_B, target, 20)
  const submissionA = stationaryAssault(PLAYER_A, attackerA, target)
  const submissionB = stationaryAssault(PLAYER_B, attackerB, target)
  return { target, attackerA, attackerB, submissionA, submissionB }
}

export function resolve({
  turn = 1,
  planets,
  fleets,
  submissions,
  rng = createSeededRng(),
  ruleset = TestRuleset,
}: ResolveOptions): ResolvedTurnState {
  const result = resolveTurn(
    createTurnStateStub({
      turn,
      submittedActions: submissions,
      planets: indexBy("id", planets),
      fleets: indexBy("id", fleets),
      players: indexBy(
        "id",
        [PLAYER_A, PLAYER_B, PLAYER_C].map((id) => ({
          id,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 100,
            [ResourceType.METAL]: 100,
            [ResourceType.FUEL]: 100,
          }),
        })),
      ),
    }),
    ruleset,
    rng,
  )
  Assert.isSuccess(result)
  return result.value
}

export function planet(id: string, ownerPlayerId: PlayerId, x: number): Planet {
  return createPlanetStub({ id, ownerPlayerId, x, y: 0 })
}

export function fleet(id: string, ownerPlayerId: PlayerId, home: Planet, strength: number): Fleet {
  return createFleetStub({
    id,
    ownerPlayerId,
    originPlanetId: home.id,
    strength,
    name: id + "-name",
  })
}

export function moveSubmission(
  playerId: PlayerId,
  source: Fleet,
  target: Planet,
  { strength, actionDefinitionId }: { strength: number; actionDefinitionId: string },
): ReturnType<typeof createSubmittedActionStub> {
  return createSubmittedActionStub({
    id: actionDefinitionId + "_1",
    playerId,
    actionDefinitionId,
    selectedTargets: { fleet: source.id, planet: target.id },
    selectedInputs: { strength },
  })
}

export function buildSubmission(playerId: PlayerId, target: Planet): ReturnType<typeof createSubmittedActionStub> {
  return createSubmittedActionStub({
    id: "BUILD_FLEET_STANDARD_1",
    playerId,
    actionDefinitionId: "BUILD_FLEET_STANDARD",
    selectedTargets: { planet: target.id },
    selectedInputs: {},
  })
}

export function attackMove(
  playerId: PlayerId,
  source: Fleet,
  target: Planet,
  strength: number,
): ReturnType<typeof createSubmittedActionStub> {
  return createSubmittedActionStub({
    id: AttackMoveTest.id + "_1",
    playerId,
    actionDefinitionId: AttackMoveTest.id,
    selectedTargets: { fleet: source.id, planet: target.id },
    selectedInputs: { strength },
  })
}

export function stationaryAssault(playerId: PlayerId, source: Fleet, target: Planet): ReturnType<typeof createSubmittedActionStub> {
  return createSubmittedActionStub({
    id: StationaryAssaultTest.id + "_1",
    playerId,
    actionDefinitionId: StationaryAssaultTest.id,
    selectedTargets: { station: source.id, battlePlanet: target.id },
  })
}

export function assaultOutcomesFor(result: ResolvedTurnState, playerId: PlayerId, submittedActionId: string): EffectOutcome[] {
  const action = result.resolvedActions.find(
    ({ submittedAction }) => submittedAction.playerId === playerId && submittedAction.id === submittedActionId,
  )
  return action?.actionOutcomes.filter(isAssaultOutcome) ?? []
}

export function isAssaultOutcome(outcome: EffectOutcome): boolean {
  return outcome.type === "RESOLVED" && (outcome.result.includes("exchanged") || outcome.result.includes("found no enemy Fleets"))
}

export function compareNormalizedOutcome(
  first: { playerId: string; actionId: string },
  second: { playerId: string; actionId: string },
): number {
  const playerOrder = compareOrdinalStrings(first.playerId, second.playerId)
  if (playerOrder !== 0) {
    return playerOrder
  }
  return compareOrdinalStrings(first.actionId, second.actionId)
}

export function ownerStrengths(fleets: Readonly<Record<string, Fleet>>, ownerPlayerId: PlayerId): number[] {
  return Object.values(fleets)
    .filter((candidate) => candidate.ownerPlayerId === ownerPlayerId)
    .map((candidate) => candidate.strength)
    .toSorted((first, second) => first - second)
}

export function outcomeText(result: ReturnType<typeof resolve>, playerId: PlayerId, submittedActionId?: string): string {
  const outcome = lastOutcome(result, playerId, submittedActionId)
  return outcome.type === "RESOLVED" ? outcome.result : outcome.reason
}

export function lastOutcome(result: ReturnType<typeof resolve>, playerId: PlayerId, submittedActionId?: string): EffectOutcome {
  const action = result.resolvedActions.find(
    (candidate) =>
      candidate.submittedAction.playerId === playerId &&
      (submittedActionId === undefined || candidate.submittedAction.id === submittedActionId),
  )
  const outcome = action?.actionOutcomes.at(-1)
  if (outcome === undefined) {
    throw new Error("Expected the player's submitted order to have an outcome")
  }
  return outcome
}
