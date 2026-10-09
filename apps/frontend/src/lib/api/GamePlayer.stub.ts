import type { GamePlayer } from "@api-types"
import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { AliasSchema } from "shared/domain/accounts/Alias.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"

/**
 * Creates a deterministic player for isolated frontend stories.
 */
export function createGamePlayerStub({
  id = "00000000-0000-4000-8000-000000000001",
  alias = "Alice",
  color = "TURQUOISE",
}: Partial<UnbrandedProperties<GamePlayer>> = {}): GamePlayer {
  return { id: typedParse(PlayerIdSchema, id), alias: typedParse(AliasSchema, alias), color }
}
