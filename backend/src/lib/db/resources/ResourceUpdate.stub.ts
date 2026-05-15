import { ResourceType } from "#lib/gameResources.ts"
import type { ResourceUpdate } from "#lib/db/resources/gamePlayerResources.repository.ts"

export function createResourceUpdateStub(override: Partial<ResourceUpdate> = {}): ResourceUpdate {
  return {
    gameId: 1,
    playerId: 1,
    resourceType: ResourceType.MONEY,
    amountDelta: 1,
    ...override,
  }
}
