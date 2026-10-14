import { Assert } from "@guillaume-docquier/tools-ts"
import type { PositiveNumber } from "@guillaume-docquier/tools-ts/schemas"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinitionTargetDefinition } from "shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { expect } from "vitest"
import type { Planet, Fleet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { createPublicAssaultStagingFixture as CapturedcreatePublicAssaultStagingFixture } from "#tests/fleet-worker/TurnProcessor.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  observeTurnAndRollback,
  ownerPublicForces,
  getActionToSubmintegrationTest,
  logWorkerObservation,
} from "../fleet-worker/TurnProcessor.scenarios.ts"

export async function assertIndex(input: AssertIndexInput): Promise<void> {
  for (let index = 0; index < 2; index += 1) {
    const client = input.fixture.clients[index]
    const view = input.beforeViews[index]
    const fleet = input.fixture.stationed[index]
    const definition = input.definitions[index]
    const force = input.forces[index]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(fleet)
    Assert.isDefined(definition)
    Assert.isDefined(force)
    const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === definition.id)
    Assert.isDefined(action)
    input.actionIds.push(action.id)
    await client.client.gameplay.updateActionSubmission.mutate({
      gameId: input.fixture.gameId,
      turn: view.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        view,
        definition.id,
        { fleet: fleet.id, planet: input.target.id },
        { strength: force },
      ),
    })
  }
}

export type AssertIndexInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  beforeViews: PlayerView[]
  definitions: readonly [
    {
      id: ActionDefinitionId
      name: string
      type: "AGENDA" | "DIRECTIVE" | "PROGRAM"
      tier: "BASIC" | "STANDARD" | "IMPROVED" | "ADVANCED" | "EXCEPTIONAL"
      inputs: Record<InputTag, { type: "POSITIVE_INTEGER"; label: string }>
      targets: Record<
        TargetTag,
        {
          targetType: "FLEET" | "PLANET" | "PLAYER"
          constraints: ReadonlyArray<
            | { type: "OWNED_BY_SUBMITTING_PLAYER"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "STATIONARY_FLEET"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "WITHIN_FLEET_RANGE"; references: { sourceFleetTag: TargetTag }; parameters: { maxDistance: PositiveNumber } }
            | { type: "DIFFERENT_FROM_FLEET_ORIGIN"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "AT_FLEET_PLANET"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "UNCLAIMED_PLANET"; references: Record<string, never>; parameters: Record<string, never> }
          >
        }
      >
      costs: Array<{
        type: "RESOURCE_LOSS"
        targets: Record<string, never>
        parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
      }>
      effects: Array<
        | {
            type: "FLEET_ASSAULT"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: Record<string, never>
          }
        | {
            type: "FLEET_COLONIZE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strengthRequirement: PositiveInteger }
          }
        | {
            type: "RESOURCE_LOSS"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | {
            type: "RESOURCE_GAIN"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | { type: "VICTORY"; targets: Record<string, never>; parameters: Record<string, never> }
        | {
            type: "FLEET_BUILD"
            targets: { planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strength: PositiveInteger }
          }
        | {
            type: "FLEET_MOVE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            inputs: { strength: { actionInputTag: InputTag; inputType: "POSITIVE_INTEGER" } }
            parameters: { speed: PositiveNumber }
          }
      >
    },
    {
      id: ActionDefinitionId
      name: string
      type: "AGENDA" | "DIRECTIVE" | "PROGRAM"
      tier: "BASIC" | "STANDARD" | "IMPROVED" | "ADVANCED" | "EXCEPTIONAL"
      inputs: Record<InputTag, { type: "POSITIVE_INTEGER"; label: string }>
      targets: Record<
        TargetTag,
        {
          targetType: "FLEET" | "PLANET" | "PLAYER"
          constraints: ReadonlyArray<
            | { type: "OWNED_BY_SUBMITTING_PLAYER"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "STATIONARY_FLEET"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "WITHIN_FLEET_RANGE"; references: { sourceFleetTag: TargetTag }; parameters: { maxDistance: PositiveNumber } }
            | { type: "DIFFERENT_FROM_FLEET_ORIGIN"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "AT_FLEET_PLANET"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "UNCLAIMED_PLANET"; references: Record<string, never>; parameters: Record<string, never> }
          >
        }
      >
      costs: Array<{
        type: "RESOURCE_LOSS"
        targets: Record<string, never>
        parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
      }>
      effects: Array<
        | {
            type: "FLEET_ASSAULT"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: Record<string, never>
          }
        | {
            type: "FLEET_COLONIZE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strengthRequirement: PositiveInteger }
          }
        | {
            type: "RESOURCE_LOSS"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | {
            type: "RESOURCE_GAIN"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | { type: "VICTORY"; targets: Record<string, never>; parameters: Record<string, never> }
        | {
            type: "FLEET_BUILD"
            targets: { planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strength: PositiveInteger }
          }
        | {
            type: "FLEET_MOVE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            inputs: { strength: { actionInputTag: InputTag; inputType: "POSITIVE_INTEGER" } }
            parameters: { speed: PositiveNumber }
          }
      >
    },
  ]
  forces: readonly [30, 20]
  actionIds: string[]
  target: Planet
}

export type AssertIndex2Input = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  beforeViews: PlayerView[]
  definitions: readonly [
    {
      id: ActionDefinitionId
      name: string
      type: "AGENDA" | "DIRECTIVE" | "PROGRAM"
      tier: "BASIC" | "STANDARD" | "IMPROVED" | "ADVANCED" | "EXCEPTIONAL"
      inputs: Record<InputTag, { type: "POSITIVE_INTEGER"; label: string }>
      targets: Record<
        TargetTag,
        {
          targetType: "FLEET" | "PLANET" | "PLAYER"
          constraints: ReadonlyArray<
            | { type: "OWNED_BY_SUBMITTING_PLAYER"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "STATIONARY_FLEET"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "WITHIN_FLEET_RANGE"; references: { sourceFleetTag: TargetTag }; parameters: { maxDistance: PositiveNumber } }
            | { type: "DIFFERENT_FROM_FLEET_ORIGIN"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "AT_FLEET_PLANET"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "UNCLAIMED_PLANET"; references: Record<string, never>; parameters: Record<string, never> }
          >
        }
      >
      costs: Array<{
        type: "RESOURCE_LOSS"
        targets: Record<string, never>
        parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
      }>
      effects: Array<
        | {
            type: "FLEET_ASSAULT"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: Record<string, never>
          }
        | {
            type: "FLEET_COLONIZE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strengthRequirement: PositiveInteger }
          }
        | {
            type: "RESOURCE_LOSS"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | {
            type: "RESOURCE_GAIN"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | { type: "VICTORY"; targets: Record<string, never>; parameters: Record<string, never> }
        | {
            type: "FLEET_BUILD"
            targets: { planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strength: PositiveInteger }
          }
        | {
            type: "FLEET_MOVE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            inputs: { strength: { actionInputTag: InputTag; inputType: "POSITIVE_INTEGER" } }
            parameters: { speed: PositiveNumber }
          }
      >
    },
    {
      id: ActionDefinitionId
      name: string
      type: "AGENDA" | "DIRECTIVE" | "PROGRAM"
      tier: "BASIC" | "STANDARD" | "IMPROVED" | "ADVANCED" | "EXCEPTIONAL"
      inputs: Record<InputTag, { type: "POSITIVE_INTEGER"; label: string }>
      targets: Record<
        TargetTag,
        {
          targetType: "FLEET" | "PLANET" | "PLAYER"
          constraints: ReadonlyArray<
            | { type: "OWNED_BY_SUBMITTING_PLAYER"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "STATIONARY_FLEET"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "WITHIN_FLEET_RANGE"; references: { sourceFleetTag: TargetTag }; parameters: { maxDistance: PositiveNumber } }
            | { type: "DIFFERENT_FROM_FLEET_ORIGIN"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "AT_FLEET_PLANET"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "UNCLAIMED_PLANET"; references: Record<string, never>; parameters: Record<string, never> }
          >
        }
      >
      costs: Array<{
        type: "RESOURCE_LOSS"
        targets: Record<string, never>
        parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
      }>
      effects: Array<
        | {
            type: "FLEET_ASSAULT"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: Record<string, never>
          }
        | {
            type: "FLEET_COLONIZE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strengthRequirement: PositiveInteger }
          }
        | {
            type: "RESOURCE_LOSS"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | {
            type: "RESOURCE_GAIN"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | { type: "VICTORY"; targets: Record<string, never>; parameters: Record<string, never> }
        | {
            type: "FLEET_BUILD"
            targets: { planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strength: PositiveInteger }
          }
        | {
            type: "FLEET_MOVE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            inputs: { strength: { actionInputTag: InputTag; inputType: "POSITIVE_INTEGER" } }
            parameters: { speed: PositiveNumber }
          }
      >
    },
    {
      id: ActionDefinitionId
      name: string
      type: "AGENDA" | "DIRECTIVE" | "PROGRAM"
      tier: "BASIC" | "STANDARD" | "IMPROVED" | "ADVANCED" | "EXCEPTIONAL"
      inputs: Record<InputTag, { type: "POSITIVE_INTEGER"; label: string }>
      targets: Record<
        TargetTag,
        {
          targetType: "FLEET" | "PLANET" | "PLAYER"
          constraints: ReadonlyArray<
            | { type: "OWNED_BY_SUBMITTING_PLAYER"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "STATIONARY_FLEET"; references: Record<string, never>; parameters: Record<string, never> }
            | { type: "WITHIN_FLEET_RANGE"; references: { sourceFleetTag: TargetTag }; parameters: { maxDistance: PositiveNumber } }
            | { type: "DIFFERENT_FROM_FLEET_ORIGIN"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "AT_FLEET_PLANET"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
            | { type: "UNCLAIMED_PLANET"; references: Record<string, never>; parameters: Record<string, never> }
          >
        }
      >
      costs: Array<{
        type: "RESOURCE_LOSS"
        targets: Record<string, never>
        parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
      }>
      effects: Array<
        | {
            type: "FLEET_ASSAULT"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: Record<string, never>
          }
        | {
            type: "FLEET_COLONIZE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strengthRequirement: PositiveInteger }
          }
        | {
            type: "RESOURCE_LOSS"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | {
            type: "RESOURCE_GAIN"
            targets: Record<string, never>
            parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
          }
        | { type: "VICTORY"; targets: Record<string, never>; parameters: Record<string, never> }
        | {
            type: "FLEET_BUILD"
            targets: { planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strength: PositiveInteger }
          }
        | {
            type: "FLEET_MOVE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            inputs: { strength: { actionInputTag: InputTag; inputType: "POSITIVE_INTEGER" } }
            parameters: { speed: PositiveNumber }
          }
      >
    },
  ]
  forces: readonly [10, 30, 20]
  actionIds: string[]
  target: Planet
}

export function assertOwnerPublicForces(input: AssertOwnerPublicForcesInput): void {
  expect(ownerPublicForces(input.afterViews[0]?.fleets ?? [], input.fixture.playerIds, input.target.id)).toStrictEqual(input.expectedForces)
  expect(input.afterViews[0]?.fleets.find(({ id }) => id === input.firstFleet.id)).toBeUndefined()
  expect(input.afterViews[0]?.fleets.find(({ id }) => id === input.firstJourneyId)).toMatchObject({
    id: input.firstJourneyId,
    name: input.firstFleet.name,
    ownerPlayerId: input.playerAId,
    strength: 10,
    originPlanetId: input.target.id,
  })
  expect(input.afterViews[0]?.fleets.find(({ id }) => id === input.laterFleet.id)).toBeUndefined()
  expect(input.afterViews[0]?.fleets.find(({ id }) => id === input.laterJourneyId)).toBeUndefined()
  for (let index = 0; index < 2; index += 1) {
    const before = input.beforeViews[index]
    const after = input.afterViews[index]
    const actionId = input.actionIds[index]
    Assert.isDefined(before)
    Assert.isDefined(after)
    Assert.isDefined(actionId)
    expect(after.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(after.resources[ResourceType.INFLUENCE].total).toBe(before.resources[ResourceType.INFLUENCE].total - 5)
    expect(after.resources[ResourceType.FUEL].total).toBe(before.resources[ResourceType.FUEL].total - 1)
  }
}

export type AssertOwnerPublicForcesInput = {
  afterViews: PlayerView[]
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  target: Planet
  expectedForces: Record<string, number[]>
  firstFleet: Fleet
  firstJourneyId: string
  playerAId: PlayerId
  laterFleet: Fleet
  laterJourneyId: string
  beforeViews: PlayerView[]
  actionIds: string[]
}

export async function assertEmptyObserved(input: AssertEmptyObservedInput): Promise<void> {
  await Promise.all(
    input.fixture.clients.map(
      async ({ client }) =>
        await client.gameplay.updateReadiness.mutate({
          gameId: input.fixture.gameId,
          turn: input.emptyTurn.turn,
          isReady: true,
        }),
    ),
  )
  const emptyObserved = await observeTurnAndRollback({ ...input, gameId: input.fixture.gameId, turn: input.emptyTurn.turn })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(emptyObserved.rngState).toStrictEqual(input.assertEmptyObservedPhase3Observed.rngState)
  logWorkerObservation(
    "[I2-04 public worker]",
    JSON.stringify({
      generatorState: input.assertEmptyObservedPhase3Observed.rngState.generatorState,
      draws: [],
      ticks: [5, 15],
      order: [input.fixture.playerIds[0], input.fixture.playerIds[1]],
      nextState: emptyObserved.rngState,
    }),
  )
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export type AssertEmptyObservedInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  emptyTurn: PlayerView
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  assertEmptyObservedPhase3Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
}

export type AssertEmptyObserved2Input = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  emptyTurn: PlayerView
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  assertEmptyObservedPhase6Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
}
