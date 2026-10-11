import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
/** Semantic ownership survives JSON reconstruction and later instance reuse. */
export type ActionResolutionOrigin = Readonly<{ initiatingTurn: number; submittedAction: SubmittedAction }>
export function actionOriginKey(origin: ActionResolutionOrigin): string {
  return JSON.stringify([origin.initiatingTurn, origin.submittedAction.playerId, origin.submittedAction.id])
}
export function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
export function compareOrigins(a: ActionResolutionOrigin, b: ActionResolutionOrigin): number {
  const turn = a.initiatingTurn - b.initiatingTurn
  if (turn !== 0) return turn
  const player = compareCodePoints(a.submittedAction.playerId, b.submittedAction.playerId)
  return player !== 0 ? player : compareCodePoints(a.submittedAction.id, b.submittedAction.id)
}
function equalRecord(left: object, right: object): boolean {
  return (
    JSON.stringify(Object.entries(left).sort(([a], [b]) => compareCodePoints(a, b))) ===
    JSON.stringify(Object.entries(right).sort(([a], [b]) => compareCodePoints(a, b)))
  )
}
export function sameSubmission(a: SubmittedAction, b: SubmittedAction): boolean {
  return (
    a.id === b.id &&
    a.playerId === b.playerId &&
    a.actionDefinitionId === b.actionDefinitionId &&
    equalRecord(a.selectedTargets, b.selectedTargets) &&
    equalRecord(a.selectedInputs, b.selectedInputs)
  )
}
