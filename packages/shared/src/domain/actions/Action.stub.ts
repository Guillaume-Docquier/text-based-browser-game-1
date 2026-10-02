import type { DeepUnbranded, UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { AvailableActionSchema, type AvailableAction, SubmittedActionSchema, type SubmittedAction } from "#shared/domain/actions/Action.ts"

export function createAvailableActionStub({
  id = v4(),
  playerId = v4(),
  actionDefinitionId = v4(),
  ...overrides
}: Partial<UnbrandedProperties<AvailableAction>> = {}): AvailableAction {
  return typedParse(AvailableActionSchema, { id, playerId, actionDefinitionId, selectedTargets: null, ...overrides })
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
  return typedParse(SubmittedActionSchema, { id, playerId, actionDefinitionId, selectedTargets, ...overrides })
}
