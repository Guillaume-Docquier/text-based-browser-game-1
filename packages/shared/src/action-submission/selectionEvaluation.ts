import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Resources } from "#shared/domain/resources/Resources.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

export type ActionSelectionDraft = Readonly<{
  actionId: ActionId
  selectedTargets: Readonly<Record<TargetTag, TargetId | undefined>>
  selectedInputs: Readonly<Record<InputTag, number | undefined>>
}>

export type EligibilityState = Readonly<{
  gameId: GameId
  turn: number
  submittingPlayerId: PlayerId
  resources: Readonly<Resources>
  players: Readonly<Record<PlayerId, EligibilityPlayer>>
  planets: Readonly<Record<PlanetId, EligibilityPlanet>>
  fleets: Readonly<Record<FleetId, Fleet>>
  actions: readonly Action[]
}>

export type EligibilityPlanet = Readonly<{
  id: PlanetId
  ownerPlayerId: PlayerId | null
  x: number
  y: number
}>

export type EligibilityPlayer = Readonly<{
  id: PlayerId
  ownerPlayerId: PlayerId
}>

export type EligibilityIssueCode =
  | "ACTION_NOT_AUTHORIZED"
  | "ACTION_DEFINITION_MISSING"
  | "ACTION_DEFINITION_MISMATCH"
  | "SUBMITTING_PLAYER_MISSING"
  | "ACTION_ALREADY_IN_PROGRESS"
  | "DUPLICATE_ACTION"
  | "DUPLICATE_ACTION_OCCUPANCY"
  | "INVALID_MOVEMENT_BINDING"
  | "MISSING_TARGET"
  | "UNEXPECTED_TARGET"
  | "UNKNOWN_TARGET"
  | "TARGET_TYPE_MISMATCH"
  | "TARGET_NOT_OWNED"
  | "PLANET_ALREADY_CLAIMED"
  | "FLEET_NOT_STATIONARY"
  | "FLEET_HAS_NO_STRENGTH"
  | "MISSING_INPUT"
  | "UNEXPECTED_INPUT"
  | "INVALID_INPUT"
  | "DEPENDENCY_INCOMPLETE"
  | "DEPENDENCY_INVALID"
  | "MISSING_ORIGIN"
  | "OUT_OF_RANGE"
  | "SAME_AS_ORIGIN"
  | "INSUFFICIENT_STRENGTH"
  | "INSUFFICIENT_RESOURCES"

export type EligibilityIssue = Readonly<{
  code: EligibilityIssueCode
  actionId?: ActionId
  targetTag?: TargetTag
  inputTag?: InputTag
  resourceType?: ResourceType
  message: string
}>

export type SelectionEvaluation = Readonly<{
  status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
  issues: readonly EligibilityIssue[]
  missingTargets: readonly TargetTag[]
  missingInputs: readonly InputTag[]
  resourceCommitments: Readonly<Resources>
  strengthCommitments: Readonly<Record<FleetId, number>>
  remainingStrength: Readonly<Record<FleetId, number>>
}>

export type TargetCandidateEvaluation = SelectionEvaluation &
  Readonly<{
    candidateStatus: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    candidateIssues: readonly EligibilityIssue[]
  }>

export type ProposedSelection = Readonly<{
  actionId: ActionId
  selectedTargets: Readonly<Record<string, TargetId | undefined>>
  selectedInputs: Readonly<Record<string, number | undefined>>
}>

export type MutableEvaluation = {
  issues: EligibilityIssue[]
  missingTargets: TargetTag[]
  missingInputs: InputTag[]
  resourceCommitments: Resources
  strengthCommitments: Record<FleetId, number>
}

export function isFleetMoveEffectDefinition(effectDefinition: EffectDefinition): effectDefinition is FleetMoveEffectDefinition {
  return effectDefinition.type === FleetMoveEffectDefinition.type
}

export function getOwnRecordValue<TKey extends string, TValue>(record: Readonly<Record<TKey, TValue>>, key: string): TValue | undefined {
  return isOwnRecordKey(record, key) ? record[key] : undefined
}
function isOwnRecordKey<TKey extends string>(record: Readonly<Record<TKey, unknown>>, key: string): key is TKey {
  return Object.hasOwn(record, key)
}

export function addIssue(evaluation: MutableEvaluation, issue: EligibilityIssue): void {
  evaluation.issues.push(issue)
}

export function createZeroResources(): Resources {
  return {
    [ResourceType.INFLUENCE]: 0,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 0,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  }
}

export function getStatus(issues: readonly EligibilityIssue[]): SelectionEvaluation["status"] {
  if (issues.some((issue) => issue.code !== "MISSING_TARGET" && issue.code !== "MISSING_INPUT" && issue.code !== "DEPENDENCY_INCOMPLETE")) {
    return "INELIGIBLE"
  }
  return issues.length === 0 ? "ELIGIBLE" : "INCOMPLETE"
}

export function compareIssues(first: EligibilityIssue, second: EligibilityIssue): number {
  return (
    [
      compareIssueIdentity(first, second),
      compareIssueSlots(first, second),
      resourceRank(first.resourceType) - resourceRank(second.resourceType),
      compareOrdinalStrings(first.message, second.message),
    ].find((comparison) => comparison !== 0) ?? 0
  )
}
function compareIssueIdentity(first: EligibilityIssue, second: EligibilityIssue): number {
  const actionOrder = compareOrdinalStrings(first.actionId ?? "", second.actionId ?? "")
  return actionOrder !== 0 ? actionOrder : compareOrdinalStrings(first.code, second.code)
}
function compareIssueSlots(first: EligibilityIssue, second: EligibilityIssue): number {
  const targetOrder = compareOrdinalStrings(first.targetTag ?? "", second.targetTag ?? "")
  return targetOrder !== 0 ? targetOrder : compareOrdinalStrings(first.inputTag ?? "", second.inputTag ?? "")
}
function resourceRank(resource: ResourceType | undefined): number {
  return resource === undefined ? -1 : Object.values(ResourceType).indexOf(resource)
}

export function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].toSorted((first, second) => compareOrdinalStrings(first, second))
}
