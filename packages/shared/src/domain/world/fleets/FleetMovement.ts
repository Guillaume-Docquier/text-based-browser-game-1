import { PositiveNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { SubmittedActionSchema } from "#shared/domain/turns/actions/Action.ts"
import { PendingArrivalEffectSchema } from "#shared/domain/world/fleets/PendingArrivalEffect.ts"
export const FleetMovementSchema = z.object({
  type: z.literal("FLEET_MOVE"),
  initiatingTurn: z.number().int().nonnegative(),
  submittedAction: SubmittedActionSchema,
  pendingArrivalEffects: z.array(PendingArrivalEffectSchema).optional(),
  speed: z.number().pipe(PositiveNumberSchema),
})
export type FleetMovement = z.infer<typeof FleetMovementSchema>
