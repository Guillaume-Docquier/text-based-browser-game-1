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

// CONSTRAINT: tRPC passes the subscription iterator to its output parser, so validate each snapshot as it is yielded.
export const TurnStateStreamSchema = z
  .custom<AsyncIterable<TurnState>>((value) => typeof value === "object" && value !== null && Symbol.asyncIterator in value)
  .transform(async function* (snapshots: AsyncIterable<TurnState>): AsyncGenerator<TurnState, void> {
    for await (const snapshot of snapshots) {
      yield TurnStateSchema.parse(snapshot)
    }
  })
