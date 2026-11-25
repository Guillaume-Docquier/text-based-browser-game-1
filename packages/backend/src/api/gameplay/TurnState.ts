import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { TurnStatusSchema } from "shared/domain/turns/TurnStatus.ts"
import { z } from "zod"

const TurnStateSchema = z.object({
  turn: z.number(),
  turnStatus: TurnStatusSchema,
  turnEndsAt: z.date(),
  readinessByPlayerId: z.record(PlayerIdSchema, z.boolean()),
})

export type TurnState = z.infer<typeof TurnStateSchema>

export const TurnStateStreamSchema = z
  .custom<AsyncIterable<TurnState>>((value: unknown) => typeof value === "object" && value !== null && Symbol.asyncIterator in value)
  .transform(async function* (snapshots): AsyncGenerator<TurnState> {
    for await (const snapshot of snapshots) {
      yield typedParse(TurnStateSchema, snapshot)
    }
  })
