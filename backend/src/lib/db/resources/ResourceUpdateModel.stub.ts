import { v4 } from "uuid"
import type { ResourceUpdateModel } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { ResourceType } from "#lib/gameResources.ts"

export function createResourceUpdateModelStub(override: Partial<ResourceUpdateModel> = {}): ResourceUpdateModel {
  return {
    gameId: 999,
    playerId: v4(),
    resourceType: ResourceType.MONEY,
    amountDelta: 1,
    ...override,
  }
}
