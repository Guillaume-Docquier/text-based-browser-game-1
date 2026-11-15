import { GameConfigurationSchema } from "shared/domain/games/GameConfiguration.ts"
import { z } from "zod"

export type CreateGameCommand = z.infer<typeof CreateGameCommandSchema>
export const CreateGameCommandSchema = z.object({
  configuration: GameConfigurationSchema,
})
