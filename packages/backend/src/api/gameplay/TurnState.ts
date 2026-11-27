import { TypeGuard } from "@guillaume-docquier/tools-ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { TurnStatusSchema } from "shared/domain/turns/TurnStatus.ts"
import { z } from "zod"

export type TurnState = z.infer<typeof TurnStateSchema>
export const TurnStateSchema = z.object({
  turn: z.number(),
  turnStatus: TurnStatusSchema,
  turnEndsAt: z.date(),
  readinessByPlayerId: z.record(PlayerIdSchema, z.boolean()),
})

export const TurnStateStreamSchema = z
  .custom<AsyncIterable<unknown>>((value) => TypeGuard.isRecord(value) && TypeGuard.isFunction(value[Symbol.asyncIterator]))
  .transform(async function* (snapshots): AsyncGenerator<TurnState> {
    for await (const snapshot of snapshots) {
      yield TurnStateSchema.parse(snapshot)
    }
  })
