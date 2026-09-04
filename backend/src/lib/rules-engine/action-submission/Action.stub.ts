import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { type PlayerId } from "#lib/db/players/PlayerId.ts"
import type { AvailableAction, SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"

export function createAvailableActionStub({
  id = v4(),
  playerId = v4(),
  ...overrides
}: Partial<UnbrandedProperties<AvailableAction>> = {}): AvailableAction {
  return {
    id: branded(id),
    playerId: branded(playerId),
    actionDefinitionId: v4(),
    targets: null,
    ...overrides,
  }
}

export function createSubmittedActionStub({
  id = v4(),
  playerId = v4(),
  ...overrides
}: Partial<UnbrandedProperties<SubmittedAction>> = {}): SubmittedAction {
  const brandedPlayerId = branded<PlayerId>(playerId)

  return {
    id: branded(id),
    playerId: brandedPlayerId,
    actionDefinitionId: v4(),
    targets: {
      self: brandedPlayerId,
    },
    ...overrides,
  }
}
