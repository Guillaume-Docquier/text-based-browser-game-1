import { v4 } from "uuid"
import { ActionId } from "#lib/db/actions/ActionId.ts"
import { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { AvailableAction, SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"

export function createAvailableActionStub(overrides?: Partial<AvailableAction>): AvailableAction {
  return {
    id: ActionId.parse(v4()),
    playerId: PlayerId.parse(v4()),
    actionDefinitionId: v4(),
    targets: null,
    ...overrides,
  }
}

export function createSubmittedActionStub(overrides?: Partial<SubmittedAction>): SubmittedAction {
  const playerId = PlayerId.parse(v4())

  return {
    id: ActionId.parse(v4()),
    playerId,
    actionDefinitionId: v4(),
    targets: {
      self: playerId,
    },
    ...overrides,
  }
}
