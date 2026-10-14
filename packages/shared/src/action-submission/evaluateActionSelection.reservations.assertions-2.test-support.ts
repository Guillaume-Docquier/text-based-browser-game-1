import { expect } from "vitest"
import type { EligibilityIssueCode } from "#shared/action-submission/selectionEvaluation.ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

export function assertMoveReplacement(input: AssertMoveReplacementInput): void {
  expect(input.moveReplacement.status).toBe("ELIGIBLE")
  expect(input.moveReplacement.strengthCommitments[input.fixture.fleetId]).toBe(34)
  expect(input.moveReplacement.remainingStrength[input.fixture.fleetId]).toBe(1)
  expect(input.moveReplacement.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 28,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
  expect(input.eitherUpdateOrder.status).toBe("ELIGIBLE")
  expect(input.reversedUpdateOrder.status).toBe("ELIGIBLE")
  expect(input.eitherUpdateOrder.strengthCommitments[input.fixture.fleetId]).toBe(35)
  expect(input.reversedUpdateOrder.strengthCommitments[input.fixture.fleetId]).toBe(35)
  expect(input.eitherUpdateOrder.resourceCommitments).toStrictEqual(input.reversedUpdateOrder.resourceCommitments)
  expect(input.overcommittedMove.status).toBe("INELIGIBLE")
  expect(input.overcommittedMove.strengthCommitments[input.fixture.fleetId]).toBe(36)
  expect(input.overcommittedMove.resourceCommitments[ResourceType.INFLUENCE]).toBe(28)
  expect(input.overcommittedMove.resourceCommitments[ResourceType.FUEL]).toBe(1)
  expect(input.cancelMove.strengthCommitments[input.fixture.fleetId]).toBe(20)
  expect(input.cancelMove.remainingStrength[input.fixture.fleetId]).toBe(15)
  expect(input.cancelMove.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 25,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 0,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
  expect(input.cancelColonize.strengthCommitments[input.fixture.fleetId]).toBe(15)
  expect(input.cancelColonize.remainingStrength[input.fixture.fleetId]).toBe(20)
  expect(input.cancelColonize.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
  expect(input.replaceColonizeSource.strengthCommitments[input.fixture.fleetId]).toBe(15)
  expect(input.replaceColonizeSource.remainingStrength[input.fixture.fleetId]).toBe(20)
  expect(input.replaceColonizeSource.strengthCommitments[input.fixture.secondFleetId]).toBe(20)
  expect(input.replaceColonizeSource.remainingStrength[input.fixture.secondFleetId]).toBe(10)
  expect(input.replaceColonizeSource.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 28,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
}

export type AssertMoveReplacementInput = {
  moveReplacement: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  fixture: {
    playerId: PlayerId
    moveActionId: ActionId
    colonizeActionId: ActionId
    secondColonizeActionId: ActionId
    fleetId: FleetId
    secondFleetId: FleetId
    originId: PlanetId
    destinationId: PlanetId
    ruleset: Ruleset
    state: Readonly<{
      gameId: GameId
      turn: number
      submittingPlayerId: PlayerId
      resources: Readonly<ReturnType<typeof createResourcesStub>>
      players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
      planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
      fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
      actions: readonly Action[]
    }>
  }
  eitherUpdateOrder: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  reversedUpdateOrder: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  overcommittedMove: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  cancelMove: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  cancelColonize: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  replaceColonizeSource: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
}
