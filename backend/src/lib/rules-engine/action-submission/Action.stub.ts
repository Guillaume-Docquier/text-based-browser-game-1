import { v4 } from "uuid"
import type { AvailableAction, SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"

export function createAvailableActionStub(overrides?: Partial<AvailableAction>): AvailableAction {
  return {
    id: v4(),
    playerId: v4(),
    actionDefinitionId: v4(),
    targets: null,
    ...overrides,
  }
}

export function createSubmittedActionStub(overrides?: Partial<SubmittedAction>): SubmittedAction {
  const playerId = v4()

  return {
    id: v4(),
    playerId,
    actionDefinitionId: v4(),
    targets: {
      self: playerId,
    },
    ...overrides,
  }
}
