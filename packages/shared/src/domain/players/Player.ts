import { z } from "zod"
import { AliasSchema } from "#shared/domain/accounts/Alias.ts"
import { PlayerColorSchema } from "#shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"

export type Player = z.infer<typeof PlayerSchema>
export const PlayerSchema = z.object({
  id: PlayerIdSchema,
  alias: AliasSchema,
  color: PlayerColorSchema,
})
