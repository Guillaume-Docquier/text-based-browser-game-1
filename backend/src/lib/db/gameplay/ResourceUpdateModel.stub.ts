import { v4 } from "uuid"
import type { ResourceUpdateModel } from "#lib/db/gameplay/gamePlayerResources.repository.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"

export function createResourceUpdateModelStub(override: Partial<ResourceUpdateModel> = {}): ResourceUpdateModel {
  return {
    gameId: 999,
    playerId: v4(),
    resourceType: ResourceType.MONEY,
    amountDelta: 1,
    ...override,
  }
}
