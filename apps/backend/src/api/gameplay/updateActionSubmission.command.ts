import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"
import { SubmittedActionTargetsDtoSchema } from "./SubmittedActionTargetsDto.ts"

export type UpdateActionSubmissionCommand = z.infer<typeof UpdateActionSubmissionCommandSchema>
export const UpdateActionSubmissionCommandSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  turn: z.coerce.number(),
  submittedActionTargets: SubmittedActionTargetsDtoSchema,
})
