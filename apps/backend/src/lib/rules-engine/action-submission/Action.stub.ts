import { branded, type DeepUnbranded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { ActionDefinitionId } from "#lib/db/rulesets/ActionDefinitionId.ts"
import type { AvailableAction, SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { SelectedTargetsSchema } from "#lib/rules-engine/action-submission/SelectedTargets.ts"
import { typedParse } from "#lib/validation/typedParse.ts"

export function createAvailableActionStub({
  id = v4(),
  playerId = v4(),
  actionDefinitionId = v4(),
  ...overrides
}: Partial<UnbrandedProperties<AvailableAction>> = {}): AvailableAction {
  return {
    id: branded(id),
    playerId: branded(playerId),
    actionDefinitionId: branded<ActionDefinitionId>(actionDefinitionId),
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
    actionDefinitionId: branded<ActionDefinitionId>(actionDefinitionId),
    selectedTargets: typedParse(SelectedTargetsSchema, selectedTargets),
    ...overrides,
  }
}
