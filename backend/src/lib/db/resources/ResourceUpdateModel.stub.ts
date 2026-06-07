import { ResourceType } from "#lib/gameResources.ts"
import type { ResourceUpdateModel } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { v4 } from "uuid"

export function createResourceUpdateModelStub(override: Partial<ResourceUpdateModel> = {}): ResourceUpdateModel {
  return {
    gameId: 1,
    playerId: v4(),
    resourceType: ResourceType.MONEY,
    amountDelta: 1,
    ...override,
  }
}
