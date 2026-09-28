import { branded, type DeepUnbranded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import type { AvailableAction, SubmittedAction } from "#game-rules/action-submission/Action.ts"
import { SelectedTargetsSchema } from "#game-rules/action-submission/SelectedTargets.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"

export function createAvailableActionStub({
  id = v4(),
  playerId = v4(),
  actionDefinitionId = v4(),
  ...overrides
}: Partial<UnbrandedProperties<AvailableAction>> = {}): AvailableAction {
  return {
    id: branded(id),
    playerId: branded(playerId),
    actionDefinitionId: branded(actionDefinitionId),
    selectedTargets: null,
    ...overrides,
  }
}

export function createSubmittedActionStub({
  id = v4(),
  playerId = v4(),
  actionDefinitionId = v4(),
  selectedTargets = {},
  ...overrides
}: Partial<
  UnbrandedProperties<Omit<SubmittedAction, "selectedTargets">> & DeepUnbranded<Pick<SubmittedAction, "selectedTargets">>
> = {}): SubmittedAction {
  const brandedPlayerId = branded<PlayerId>(playerId)

  return {
    id: branded(id),
    playerId: brandedPlayerId,
    actionDefinitionId: branded(actionDefinitionId),
    selectedTargets: typedParse(SelectedTargetsSchema, selectedTargets),
    ...overrides,
  }
}
