import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { PlayerSchema, type Player } from "#shared/domain/players/Player.ts"
import { PlayerColor } from "#shared/domain/players/PlayerColor.ts"

export function createPlayerStub(overrides: Partial<UnbrandedProperties<Player>> = {}): Player {
  return typedParse(PlayerSchema, {
    id: "00000000-0000-4000-8000-000000000001",
    alias: "Alice",
    color: PlayerColor.TURQUOISE,
    ...overrides,
  })
}
