import {
  NonNegativeNumberSchema,
  type NonNegativeNumber,
  PositiveNumberSchema,
  type PositiveNumber,
} from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { NonNegativeSafeIntegerSchema, type NonNegativeSafeInteger } from "#shared/domain/NonNegativeSafeInteger.ts"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { PositiveIntegerSchema, type PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetAssaultEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { SubmittedActionSchema } from "#shared/domain/turns/actions/Action.ts"
import { FleetIdSchema, type FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema, type FleetName } from "#shared/domain/world/fleets/FleetName.ts"
import { PlanetIdSchema, type PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

/**
 * Durable speed and source Action data for an In-Transit Fleet.
 */
export type FleetMovement = Readonly<{
  speed: PositiveNumber
  departureTurn: PositiveInteger
  submission: SubmittedAction
  pendingArrivalEffects: readonly PendingArrivalAssault[]
}>

export type PendingArrivalAssault = Readonly<{
  effectDefinition: FleetAssaultEffectDefinition
  definitionOrdinal: NonNegativeSafeInteger
}>

export const PendingArrivalAssaultSchema = z
  .object({
    effectDefinition: FleetAssaultEffectDefinitionSchema,
    definitionOrdinal: NonNegativeSafeIntegerSchema,
  })
  .strict() satisfies z.ZodType<PendingArrivalAssault>

export const FleetMovementSchema = z.object({
  speed: z.number().finite().pipe(PositiveNumberSchema),
  departureTurn: PositiveIntegerSchema,
  submission: SubmittedActionSchema,
  pendingArrivalEffects: z.array(PendingArrivalAssaultSchema).readonly(),
}) satisfies z.ZodType<FleetMovement>

export type Fleet = {
  id: FleetId
  ownerPlayerId: PlayerId
  name: FleetName
  strength: NonNegativeSafeInteger
  originPlanetId: PlanetId
  /**
   * Defined only when moving.
   * We'd use a discriminated union here, but since we mutate the fleet, it's a bit hard to do.
   */
  destinationPlanetId?: PlanetId | undefined
  /**
   * Defined only when moving.
   * We'd use a discriminated union here, but since we mutate the fleet, it's a bit hard to do.
   */
  distanceToEnd?: NonNegativeNumber | undefined
  /**
   * The persisted movement speed and Action binding. Defined only while in transit.
   */
  movement?: FleetMovement | undefined
}

export const FleetSchema = z
  .object({
    id: FleetIdSchema,
    ownerPlayerId: PlayerIdSchema,
    name: FleetNameSchema,
    strength: NonNegativeSafeIntegerSchema,
    originPlanetId: PlanetIdSchema,
    destinationPlanetId: PlanetIdSchema.optional(),
    distanceToEnd: NonNegativeNumberSchema.optional(),
    movement: FleetMovementSchema.optional(),
  })
  .superRefine(validateMovementState) satisfies z.ZodType<Fleet>

/**
 * Rejects persisted Fleet data that represents only part of a journey.
 */
function validateMovementState(
  fleet: Pick<Fleet, "ownerPlayerId" | "destinationPlanetId" | "distanceToEnd" | "movement">,
  context: z.RefinementCtx,
): void {
  const movementFieldCount = [fleet.destinationPlanetId, fleet.distanceToEnd, fleet.movement].filter((value) => value !== undefined).length
  if (movementFieldCount !== 0 && movementFieldCount !== 3) {
    context.addIssue({
      code: "custom",
      message: "In-Transit Fleet data must include destinationPlanetId, distanceToEnd, and movement",
    })
  }
  if (fleet.movement !== undefined && fleet.movement.submission.playerId !== fleet.ownerPlayerId) {
    context.addIssue({
      code: "custom",
      path: ["movement", "submission", "playerId"],
      message: "In-Transit Fleet Action owner must match Fleet owner",
    })
  }
}
