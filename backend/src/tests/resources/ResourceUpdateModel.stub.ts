import { v4 } from "uuid"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { GameId } from "#lib/db/games/GameId.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { ResourceUpdateModel } from "#tests/resources/resources.repository.ts"

export function createResourceUpdateModelStub(override: Partial<ResourceUpdateModel> = {}): ResourceUpdateModel {
  return {
    gameId: GameId.parse(999),
    playerId: PlayerId.parse(v4()),
    resourceType: ResourceType.INFLUENCE,
    amountDelta: 1,
    ...override,
  }
}
