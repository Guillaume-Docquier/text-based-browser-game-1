import { v4 } from "uuid"
import { GameId } from "#lib/db/games/GameId.ts"
import { PlayerId } from "#lib/db/players/PlayerId.ts"
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
